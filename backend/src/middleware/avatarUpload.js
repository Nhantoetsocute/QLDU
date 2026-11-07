const multer = require('multer');
const sharp = require('sharp');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { writeEncryptedAvatar } = require('../security/avatarStorage');
const parser=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1}}).single('avatar');
async function normalizeImage(buffer) {
    const image=sharp(buffer,{limitInputPixels:16000000,failOn:'warning',animated:false});
    const meta=await image.metadata();
    if (!['jpeg','png','webp'].includes(meta.format) || (meta.pages || 1)!==1) throw new Error('Unsupported image');
    return image.rotate().resize(512,512,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
}
function avatarUpload(req,res,next) {
    parser(req,res,async error=>{
        if(error) return next(error);
        if(!req.file) return res.status(400).json({error:'Không tìm thấy ảnh đại diện.'});
        let buffer;
        try {
            buffer=await normalizeImage(req.file.buffer);
        } catch { return res.status(400).json({error:'Ảnh không hợp lệ. Chỉ nhận JPEG, PNG, WebP, tối đa 5MB và 16 triệu pixel.'}); }
        const filename=`avatar_${req.user.userId}_${randomBytes(16).toString('hex')}.webp`;
        const directory=path.join(__dirname,'../../public/avatars');
        try {
            await writeEncryptedAvatar(directory,filename,buffer);
            req.file={filename};
            next();
        } catch (writeError) { next(writeError); }
    });
}
module.exports={avatarUpload,normalizeImage};
