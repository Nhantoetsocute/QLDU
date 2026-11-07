module.exports = (req,res,next) => {
    res.set('X-Content-Type-Options','nosniff');
    res.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.set('X-Frame-Options','DENY');
    res.set('Referrer-Policy','no-referrer');
    if (process.env.NODE_ENV==='production') res.set('Strict-Transport-Security','max-age=31536000');
    if (req.path.startsWith('/api/')) res.set('Cache-Control','no-store');
    next();
};
