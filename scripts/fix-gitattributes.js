const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const content = [
  '# Normalize line endings',
  '* text=auto',
  '',
  '# Force LF for TypeScript/JavaScript source files (prevent CRLF corruption of Korean chars)',
  '*.ts text eol=lf',
  '*.tsx text eol=lf',
  '*.js text eol=lf',
  '*.jsx text eol=lf',
  '*.json text eol=lf',
  '*.css text eol=lf',
  '*.md text eol=lf',
  ''
].join('\n');

const tmpFile = path.join(process.cwd(), '.gitattributes.tmp');
fs.writeFileSync(tmpFile, content, 'utf8');

// Verify no CR
const check = fs.readFileSync(tmpFile);
let cr = 0;
for (let i = 0; i < check.length; i++) if (check[i] === 13) cr++;
console.log('CR in tmp file:', cr, '(should be 0)');

// Hash and store in git
const hash = execSync('git hash-object -w .gitattributes.tmp').toString().trim();
console.log('Hash:', hash);

// Update index
execSync('git update-index --cacheinfo 100644,' + hash + ',.gitattributes');
console.log('Index updated for .gitattributes');

// Also update working tree
fs.copyFileSync(tmpFile, path.join(process.cwd(), '.gitattributes'));
fs.unlinkSync(tmpFile);

// Check staged diff
const diff = execSync('git diff --cached --stat').toString();
console.log('Staged diff:', diff || '(none)');

const status = execSync('git status --short').toString();
console.log('Status:', status);
