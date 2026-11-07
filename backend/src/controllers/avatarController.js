const path = require('node:path');
const { readStoredAvatar, avatarContext } = require('../security/avatarStorage');

const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const defaultDirectory = path.join(__dirname, '../../public/avatars');
async function readOwnAvatar(userId) {
    const [rows] = await require('../config/db').execute('SELECT AvatarUrl FROM Users WHERE UserId = ? AND IsActive = 1 LIMIT 1', [userId]);
    return rows[0]?.AvatarUrl;
}
function createAvatarController({ readAvatar = readOwnAvatar, avatarDirectory = defaultDirectory,
    decrypt = (...args) => require('../security/cryptoVault').openBytes(...args) } = {}) {
    return async (req,res,next) => {
        const userId = req.user?.userId;
        if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) return res.status(401).json({error:'Yêu cầu đăng nhập.'});
        try {
            const storedPath = await readAvatar(Number(userId));
            const allowed = new RegExp(`^/avatars/avatar_${Number(userId)}_[a-z0-9_-]+\\.(png|jpg|jpeg|webp)$`);
            if (typeof storedPath !== 'string' || !allowed.test(storedPath)) return res.status(404).json({error:'Không tìm thấy ảnh đại diện.'});
            const filename = path.basename(storedPath);
            const stored = await readStoredAvatar(avatarDirectory,filename);
            // Authenticated envelopes only: legacy cleartext and altered/wrong-owner ciphertext fail closed.
            const content = decrypt(stored,avatarContext(filename));
            if (!Buffer.isBuffer(content) || content.length > 5*1024*1024) throw new Error('Invalid avatar content');
            const extension = path.extname(filename).slice(1);
            res.set({
                'Content-Type':CONTENT_TYPES[extension],
                'Cache-Control':'private, no-store',
                'X-Content-Type-Options':'nosniff',
                'Content-Disposition':`inline; filename="avatar.${extension}"`,
            });
            return res.send(content);
        } catch(error) {
            if (['ENOENT','ENOTDIR','ELOOP','AVATAR_NOT_FOUND'].includes(error.code)) return res.status(404).json({error:'Không tìm thấy ảnh đại diện.'});
            // Never expose paths, ciphertext, key IDs or raw cryptographic errors to clients/logs.
            return res.status(503).json({error:'Chưa thể đọc ảnh đại diện một cách an toàn.'});
        }
    };
}
module.exports=createAvatarController();
module.exports.createAvatarController=createAvatarController;
