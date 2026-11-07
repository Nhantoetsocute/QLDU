const { isIP } = require('node:net');
function publicOrigin(req, env = process.env) {
    const configured = require('./transport').configuredPublicOrigin(env);
    if (configured) return configured;
    // Development accepts only local addresses, never an arbitrary Host or forwarded header.
    const host=req.headers.host || '';
    let parsed;
    try { parsed=new URL(`http://${host}`); } catch { return `http://localhost:${env.PORT || 3000}`; }
    const name=parsed.hostname;
    if (name!=='localhost' && !(isIP(name)===4 && /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(name))) return `http://localhost:${env.PORT || 3000}`;
    return parsed.origin;
}
function publicAsset(req,path) {
    if (typeof path!=='string' || !/^\/(?:avatars|images)\/[A-Za-z0-9_.-]+$/.test(path)) return null;
    if (path.startsWith('/avatars/')) return `${publicOrigin(req)}/api/user/avatar?v=${encodeURIComponent(path.slice('/avatars/'.length))}`;
    return publicOrigin(req)+path;
}
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports={publicOrigin,publicAsset,escapeHtml};
