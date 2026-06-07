const fs = require('fs');
const babel = require('@babel/core');

const inputFile = 'public/index.dev.html';
let code = fs.readFileSync(inputFile, 'utf8');

const startTag = '<script type="text/babel">';
const startIdx = code.indexOf(startTag) + startTag.length;
const endIdx = code.indexOf('</script>', startIdx);
let jsxCode = code.substring(startIdx, endIdx);

const lines = jsxCode.split('\n');
console.log(`Total JSX lines: ${lines.length}`);

let fixCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const styleMatch = line.match(/(style=\{\{.*?)'([^']*?)'\)\}/);
  if (styleMatch) {
    const before = line;
    lines[i] = line.replace(/\)\}/g, '}}');
    if (lines[i] !== before) {
      console.log(`Fix ${++fixCount} at line ${i+1}: style bracket`);
    }
  }
}

jsxCode = lines.join('\n');

// Validate via Babel parse before transform
try {
  babel.parseSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx',
    parserOpts: { allowReturnOutsideFunction: true, errorRecovery: true },
  });
} catch (parseErr) {
  console.warn(`Babel parse warnings (continuing): ${parseErr.message.substring(0, 200)}`);
}

fs.writeFileSync('public/debug_jsx.js', jsxCode);

try {
  const result = babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });

  console.log(`\n✅ Babel compilation SUCCESSFUL!`);

  let htmlBefore = code.substring(0, code.indexOf(startTag));
  htmlBefore = htmlBefore.replace(
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"></script>\n',
    ''
  );

  const htmlAfter = code.substring(endIdx + '</script>'.length);
  const output = htmlBefore + '<script>' + result.code + '</script>' + htmlAfter;

  fs.writeFileSync('public/index.html', output);
  console.log(`Written to public/index.html (${output.length} bytes)`);

} catch (e) {
  const match = e.message.match(/\((\d+):(\d+)\)/);
  if (match) {
    const errLine = parseInt(match[1]);
    const errLines = jsxCode.split('\n');
    console.log(`\n❌ Error at line ${errLine}:`);
    for (let i = Math.max(0, errLine - 5); i <= Math.min(errLines.length - 1, errLine + 3); i++) {
      const marker = i + 1 === errLine ? '>>>' : '   ';
      console.log(`${marker} ${i + 1}: ${errLines[i]}`);
    }
  }
  console.error('\n' + e.message.substring(0, 400));
}
