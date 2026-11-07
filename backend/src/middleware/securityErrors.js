module.exports = (err,req,res,next) => {
    if (res.headersSent) return next(err);
    let status=500, error='Lỗi máy chủ nội bộ';
    if (err.type==='entity.too.large' || err.code==='LIMIT_FILE_SIZE') {status=413;error='Dữ liệu vượt quá giới hạn.';}
    else if (err.type==='entity.parse.failed') {status=400;error='JSON không hợp lệ.';}
    else if (err.status===400 || err.code?.startsWith('LIMIT_')) {status=400;error='Dữ liệu yêu cầu không hợp lệ.';}
    else if ([404,409,415].includes(err.status)) {status=err.status;error=err.message;}
    if (err.status===401) {status=401;error='Phiên đăng nhập không còn hợp lệ.';}
    if (err.status===503) {status=503;error='Dịch vụ tạm thời không khả dụng.';}
    if (status===500) console.error('Request failed:', err.code || 'INTERNAL_ERROR');
    res.status(status).json({error,message:error,...(err.code==='WEAK_PASSWORD'?{code:err.code}:{})});
};
