const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const versionFile = path.join(projectRoot, '.nvmrc');
const requiredMajor = Number(fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, ''));

function isSupported(version) {
    const match = /^v(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) return false;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    return major === requiredMajor && minor >= 3;
}

function versionOf(executable) {
    const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 3000 });
    return result.status === 0 ? result.stdout.trim() : null;
}

function nodesUnder(directory, prefix = '') {
    try {
        return fs.readdirSync(directory, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
            .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
            .map(entry => path.join(directory, entry.name, 'bin', 'node'))
            .filter(candidate => fs.existsSync(candidate));
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
        throw error;
    }
}

function findRuntime() {
    const candidates = [
        process.env.QLDU_NODE_BIN,
        process.execPath,
        ...nodesUnder(path.join(os.homedir(), '.nvm/versions/node'), `v${requiredMajor}.`),
        ...nodesUnder(path.join(os.homedir(), '.volta/tools/image/node'), `${requiredMajor}.`),
        ...nodesUnder(path.join(os.homedir(), '.local/share/mise/installs/node'), `${requiredMajor}.`),
        ...nodesUnder(path.join(os.homedir(), 'nodejs'), `node-v${requiredMajor}.`),
        `/opt/homebrew/opt/node@${requiredMajor}/bin/node`,
        `/usr/local/opt/node@${requiredMajor}/bin/node`,
        `/private/tmp/qldu-node${requiredMajor}/bin/node`,
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
        if (!path.isAbsolute(candidate) || !fs.existsSync(candidate)) continue;
        if (isSupported(versionOf(candidate) || '')) return candidate;
    }
    return null;
}

const args = process.argv.slice(2);
const runtime = findRuntime();
if (!runtime) {
    console.error(`QLDU cần Node.js ${requiredMajor}.3 trở lên. Cài Node ${requiredMajor}, hoặc đặt QLDU_NODE_BIN trỏ tới executable Node phù hợp.`);
    process.exitCode = 1;
} else if (!args.length) {
    console.error('Usage: node scripts/run-node.js <script-or-node-arguments>');
    process.exitCode = 2;
} else {
    const child = spawn(runtime, args, { stdio: 'inherit', cwd: process.cwd() });
    let interrupted = false;
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            interrupted = true;
            child.kill(signal);
        });
    }
    child.on('error', error => {
        console.error('Could not start Node.js child process:', error.code || 'SPAWN_FAILED');
        process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
        process.exitCode = code ?? (interrupted || signal ? 1 : 0);
    });
}
