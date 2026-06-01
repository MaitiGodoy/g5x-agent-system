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
    stack.push({ char, line, col, index: i });
  } else if (char === '}' || char === ']' || char === ')') {
    if (stack.length === 0) {
      console.log(`Unmatched closing character '${char}' at line ${line}, col ${col}`);
      continue;
    }
    const last = stack.pop();
    const matches = (last.char === '{' && char === '}') ||
                    (last.char === '[' && char === ']') ||
                    (last.char === '(' && char === ')');
    if (!matches) {
      console.log(`Mismatch: opened '${last.char}' at line ${last.line}, col ${last.col} but closed with '${char}' at line ${line}, col ${col}`);
    }
  }
}

if (stack.length > 0) {
  console.log(`Unclosed brackets at end of file: ${stack.length}`);
  stack.slice(-10).forEach(s => {
    console.log(`- '${s.char}' opened at line ${s.line}, col ${s.col}`);
  });
} else {
  console.log('All brackets are balanced!');
}
