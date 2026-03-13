/**
 * Fix all critical source files: store them in git with LF, no autocrlf.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');

const FILES = [
  'app/custom-join-tour/page.tsx',
  '.gitattributes',
];

function storeAsLF(relPath) {
  const absPath = path.join(root, relPath);
  const content = fs.readFileSync(absPath, 'utf8');
  const lfContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const tmpPath = path.join(os.tmpdir(), 'fix-lf-' + Date.now() + path.extname(relPath));
  fs.writeFileSync(tmpPath, lfContent, 'utf8');

  const hashResult = spawnSync('git', ['hash-object', '-w', '--no-filters', tmpPath], {
    cwd: root, encoding: 'utf8'
  });
  if (hashResult.status !== 0) throw new Error('hash-object failed: ' + hashResult.stderr);
  const hash = hashResult.stdout.trim();

  // Verify stored object
  const cat = spawnSync('git', ['cat-file', '-p', hash], { cwd: root, encoding: 'buffer', maxBuffer: 10*1024*1024 });
  const buf = cat.stdout;
  let cr = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 13) cr++;

  execSync(`git update-index --cacheinfo 100644,${hash},${relPath}`, { cwd: root });
  fs.writeFileSync(absPath, lfContent, 'utf8');
  fs.unlinkSync(tmpPath);

  console.log(`${relPath}: hash=${hash}, bytes=${buf.length}, CR=${cr}`);
  return hash;
}

for (const f of FILES) {
  storeAsLF(f);
}

// Now commit
const status = execSync('git status --short', { cwd: root }).toString();
console.log('\nStatus:\n' + status);

// Check if there's anything staged vs HEAD
const diff = execSync('git diff --cached --name-only', { cwd: root }).toString();
console.log('Staged files:', diff || '(none)');

// We need to force a new commit even if hashes are same
// Touch a marker file to ensure a new commit
const markerPath = path.join(root, '.vercel-rebuild');
const marker = '# Force rebuild ' + new Date().toISOString() + '\n';
fs.writeFileSync(markerPath, marker, 'utf8');

const markerTmp = path.join(os.tmpdir(), 'marker-' + Date.now() + '.txt');
fs.writeFileSync(markerTmp, marker, 'utf8');
const markerHash = spawnSync('git', ['hash-object', '-w', '--no-filters', markerTmp], { cwd: root, encoding: 'utf8' }).stdout.trim();
execSync(`git update-index --add --cacheinfo 100644,${markerHash},.vercel-rebuild`, { cwd: root });
fs.unlinkSync(markerTmp);

const diff2 = execSync('git diff --cached --name-only', { cwd: root }).toString();
console.log('Staged after marker:', diff2);
