/**
 * Force-commit files with LF line endings, bypassing core.autocrlf.
 * This directly writes file content into git object store and updates the index.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FILES_TO_FIX = [
  'app/custom-join-tour/page.tsx',
];

const root = path.resolve(__dirname, '..');

for (const relPath of FILES_TO_FIX) {
  const absPath = path.join(root, relPath);
  
  // Read current working file as UTF-8
  const content = fs.readFileSync(absPath, 'utf8');
  
  // Normalize to LF only
  const lfContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Write to a temp file (guaranteed LF, UTF-8)
  const tmpPath = path.join(os.tmpdir(), 'git-lf-tmp-' + Date.now() + '.tsx');
  fs.writeFileSync(tmpPath, lfContent, { encoding: 'utf8', flag: 'w' });
  
  // Verify no CR in temp file
  const tmpBuf = fs.readFileSync(tmpPath);
  let crCount = 0;
  for (let i = 0; i < tmpBuf.length; i++) if (tmpBuf[i] === 13) crCount++;
  
  // Verify Korean chars are intact
  const koreanMatch = lfContent.match(/[\uAC00-\uD7A3]/g);
  console.log(`${relPath}: ${lfContent.length} chars, CR=${crCount}, Korean chars=${koreanMatch ? koreanMatch.length : 0}`);
  
  if (crCount > 0) {
    console.error('ERROR: CR still present in temp file!');
    process.exit(1);
  }
  
  // Hash the LF file into git object store
  const hash = execSync(`git hash-object -w "${tmpPath}"`, { cwd: root }).toString().trim();
  console.log(`  Hash: ${hash}`);
  
  // Update git index with this hash
  execSync(`git update-index --cacheinfo 100644,${hash},${relPath}`, { cwd: root });
  console.log(`  Index updated`);
  
  // Also overwrite working tree file with LF version
  fs.writeFileSync(absPath, lfContent, { encoding: 'utf8', flag: 'w' });
  
  fs.unlinkSync(tmpPath);
}

// Verify the staged content
const stagedHash = execSync('git ls-files -s app/custom-join-tour/page.tsx', { cwd: root }).toString().trim();
console.log('\nStaged entry:', stagedHash);

// Check staged content for corruption
const stagedContent = execSync('git cat-file -p ' + stagedHash.split(/\s+/)[1], { cwd: root, maxBuffer: 10*1024*1024 });
let stagedCR = 0;
for (let i = 0; i < stagedContent.length; i++) if (stagedContent[i] === 13) stagedCR++;
const koreanInStaged = stagedContent.toString('utf8').match(/[\uAC00-\uD7A3]/g);
console.log(`Staged object: ${stagedContent.length} bytes, CR=${stagedCR}, Korean=${koreanInStaged ? koreanInStaged.length : 0}`);

// Check diff
const diff = execSync('git diff --cached --stat', { cwd: root }).toString();
console.log('Staged diff:', diff || '(none - same hash as HEAD)');

const headHash = execSync('git ls-tree HEAD app/custom-join-tour/page.tsx', { cwd: root }).toString().trim();
console.log('HEAD entry:', headHash);
