const fs = require('fs');

const code = fs.readFileSync('public/index.dev.html', 'utf8');
const startTag = '<script type="text/babel">';
const startIdx = code.indexOf(startTag) + startTag.length;
const endIdx = code.indexOf('</script>', startIdx);
const jsCode = code.substring(startIdx, endIdx);

const stack = [];
let line = 1;
let col = 1;

for (let i = 0; i < jsCode.length; i++) {
  const char = jsCode[i];
  if (char === '\n') {
    line++;
    col = 1;
  } else {
    col++;
  }
  
  if (char === '{' || char === '[' || char === '(') {
    // Find character index in index.dev.html
    const fileIndex = startIdx + i;
    // Calculate line number in index.dev.html
    const fileLine = code.substring(0, fileIndex).split('\n').length;
    stack.push({ char, line, col, fileLine, content: jsCode.substring(i, i + 60).replace(/\n/g, ' ') });
  } else if (char === '}' || char === ']' || char === ')') {
    if (stack.length > 0) {
      stack.pop();
    }
  }
}

console.log(`Total unclosed brackets: ${stack.length}`);
stack.forEach((s, idx) => {
  console.log(`[${idx+1}] '${s.char}' opened at index.dev.html line ${s.fileLine}:`);
  console.log(`    Code snippet: ${s.content}`);
});
