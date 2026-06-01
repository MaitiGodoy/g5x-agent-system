/**
 * Manual, precise fix script.
 * Fix ONLY the specific known issues, then compile.
 */
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

// Fix 1: Line with style={{...overflowY:'auto')}> — ) should be }
// Find all occurrences
let fixCount = 0;
for (let i = 0; i < lines.length; i++) {
  // Fix style objects with ) instead of }
  if (lines[i].includes("'auto')}>") || lines[i].includes("'auto')};")) {
    const before = lines[i];
    lines[i] = lines[i].replace("'auto')}", "'auto'}}");
    if (lines[i] !== before) {
      console.log(`Fix ${++fixCount} at line ${i+1}: style bracket`);
    }
  }
  
  // Same for other style values ending with )
  if (lines[i].match(/style=\{\{.*\)'*\}>/)) {
    // More general: any style={{...value)}>
    const before = lines[i];
    lines[i] = lines[i].replace(/\)\}>/g, '}}>');
    if (lines[i] !== before) {
      console.log(`Fix ${++fixCount} at line ${i+1}: general style bracket`);
    }
  }
}

// Fix 2: Map closes — find .map(x=>( patterns and their matching )}
// The issue is .map(x=>( opens 2 parens but )} only closes 1
const mapStack = [];
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  
  // Detect map opens: {something.map(x=>(  or {SOMETHING.map(x=>(
  const mapMatch = trimmed.match(/^\{.*\.map\([\w,\s()]*=>\($/);
  if (mapMatch) {
    mapStack.push(i);
    continue;
  }
  
  // Also detect inline: {something.map(x=>(   with more complex patterns
  if (/\.map\([^)]*=>\($/.test(trimmed) && trimmed.startsWith('{')) {
    mapStack.push(i);
    continue;
  }
  
  // Detect close: ))} means map is properly closed
  if (trimmed === '))}' && mapStack.length > 0) {
    mapStack.pop();
    continue;
  }
  
  // Detect broken close: )} where it should be ))}
  if (trimmed === ')}' && mapStack.length > 0) {
    // Check if the NEXT line is a closing tag (</div>, </>, etc) or another )
    // This indicates this )} is the map close, not a conditional close
    const nextTrimmed = (lines[i+1] || '').trim();
    if (nextTrimmed.startsWith('</') || nextTrimmed.startsWith('<div') || nextTrimmed === '' || nextTrimmed === '</div>') {
      lines[i] = lines[i].replace(')}', '))}');
      console.log(`Fix ${++fixCount} at line ${i+1}: map close )} → ))}`);
      mapStack.pop();
    }
  }
}

if (mapStack.length > 0) {
  console.log(`WARNING: ${mapStack.length} unclosed maps remaining at lines: ${mapStack.map(l=>l+1).join(', ')}`);
}

// Fix 3: The file structure - Root, Content, Modals are inside App but
// ReactDOM.render is outside. The original structure with everything inside App 
// and return <Root/> at the end is actually correct. Let's verify.

jsxCode = lines.join('\n');

// Save debug file
fs.writeFileSync('public/debug_jsx.js', jsxCode);

// Try compilation
try {
  const result = babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });
  
  console.log(`\n✅ Babel compilation SUCCESSFUL!`);
  
  // Build final HTML
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
