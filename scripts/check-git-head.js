const { execSync } = require('child_process');

// Check what's actually in git object for page.tsx at HEAD
const content = execSync('git show HEAD:app/custom-join-tour/page.tsx', { maxBuffer: 10 * 1024 * 1024 });

// Check raw bytes - is it UTF-16?
console.log('File size:', content.length, 'bytes');
console.log('First 6 bytes:', content[0], content[1], content[2], content[3], content[4], content[5]);

// Try reading as UTF-8
const utf8 = content.toString('utf8');
const lines = utf8.split('\n');
console.log('Lines (utf8):', lines.length);

// Check for null bytes (UTF-16 indicator)
let nullCount = 0;
for (let i = 0; i < Math.min(1000, content.length); i++) {
  if (content[i] === 0) nullCount++;
}
console.log('Null bytes in first 1000:', nullCount);

// Show lines 455-460
console.log('\nLines 455-460:');
for (let i = 454; i < 460; i++) {
  console.log((i+1) + ':', JSON.stringify(lines[i]));
}

// Check paren balance
let parens = 0;
const stack = [];
for (let i = 0; i < Math.min(665, lines.length); i++) {
  const l = lines[i];
  let inStr = false, strCh = '';
  for (let j = 0; j < l.length; j++) {
    const ch = l[j];
    if (inStr) {
      if (ch === '\\') { j++; continue; }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === '(') { parens++; stack.push(i+1); }
    else if (ch === ')') { parens--; if (stack.length) stack.pop(); }
  }
}
console.log('\nUnclosed parens at 665:', parens, '| last:', stack.slice(-3));
