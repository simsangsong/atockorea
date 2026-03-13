/**
 * Force-write LF file into git object store WITHOUT any filter/autocrlf conversion.
 * Uses git hash-object --no-filters to bypass core.autocrlf.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const relPath = 'app/custom-join-tour/page.tsx';
const absPath = path.join(root, relPath);

// Read local file (should be clean UTF-8 LF)
const content = fs.readFileSync(absPath, 'utf8');
const lfContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Verify Korean chars
const korean = lfContent.match(/[\uAC00-\uD7A3]/g);
console.log('Local file: chars=' + lfContent.length + ', Korean=' + (korean ? korean.length : 0));

// Write LF content to temp file
const tmpPath = path.join(os.tmpdir(), 'page-lf-' + Date.now() + '.tsx');
fs.writeFileSync(tmpPath, lfContent, 'utf8');

// Verify temp file bytes
const tmpBuf = fs.readFileSync(tmpPath);
let cr = 0;
for (let i = 0; i < tmpBuf.length; i++) if (tmpBuf[i] === 13) cr++;
console.log('Temp file: bytes=' + tmpBuf.length + ', CR=' + cr);

// Hash WITHOUT filters (bypasses autocrlf)
const hashResult = spawnSync('git', ['hash-object', '-w', '--no-filters', tmpPath], {
  cwd: root,
  encoding: 'utf8'
});
if (hashResult.error || hashResult.status !== 0) {
  console.error('hash-object failed:', hashResult.stderr);
  process.exit(1);
}
const hash = hashResult.stdout.trim();
console.log('New hash (no-filters):', hash);

// Verify the stored object
const catResult = spawnSync('git', ['cat-file', '-p', hash], {
  cwd: root,
  encoding: 'buffer',
  maxBuffer: 10 * 1024 * 1024
});
const storedBuf = catResult.stdout;
let storedCR = 0;
for (let i = 0; i < storedBuf.length; i++) if (storedBuf[i] === 13) storedCR++;
const storedKorean = storedBuf.toString('utf8').match(/[\uAC00-\uD7A3]/g);
console.log('Stored object: bytes=' + storedBuf.length + ', CR=' + storedCR + ', Korean=' + (storedKorean ? storedKorean.length : 0));

if (storedCR > 0) {
  console.error('ERROR: CR still in stored object!');
  process.exit(1);
}
if (!storedKorean || storedKorean.length < 50) {
  console.error('ERROR: Korean chars missing from stored object!');
  process.exit(1);
}

// Update git index
execSync(`git update-index --cacheinfo 100644,${hash},${relPath}`, { cwd: root });
console.log('Index updated');

// Overwrite working tree with clean LF version
fs.writeFileSync(absPath, lfContent, 'utf8');
console.log('Working tree updated');

fs.unlinkSync(tmpPath);

// Show staged diff
const diff = execSync('git diff --cached --stat', { cwd: root }).toString();
console.log('Staged diff:', diff || '(none)');

const headEntry = execSync('git ls-tree HEAD ' + relPath, { cwd: root }).toString().trim();
const indexEntry = execSync('git ls-files -s ' + relPath, { cwd: root }).toString().trim();
console.log('HEAD :', headEntry);
console.log('Index:', indexEntry);
