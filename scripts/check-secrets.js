const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const files = execFileSync('git', ['ls-files', '-z', '--', '.', ':!:node_modules', ':!:backend/node_modules'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let failures = 0;
for (const file of files) {
  if (/(^|\/)node_modules\//.test(file)) continue;
  if (/(^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith('.example')) {
    console.error(`Không được theo dõi file môi trường: ${file}`); failures++; continue;
  }
  if (!/\.(?:js|json|md|ya?ml|sql|example)$/.test(file)) continue;
  let source;
  try { source = readFileSync(file, 'utf8'); } catch { continue; }
  const patterns = [/AIza[0-9A-Za-z_-]{35}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/];
  if (patterns.some((pattern) => pattern.test(source))) {
    // Never print the matching secret.
    console.error(`Phát hiện thông tin xác thực trong ${file}`); failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log('Không phát hiện khóa bằng các mẫu kiểm tra hiện có.');
