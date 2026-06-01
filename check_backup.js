const fs = require('fs');
const babel = require('@babel/core');

if (!fs.existsSync('public/index.dev.html.bak')) {
  console.log('Backup file does not exist');
  process.exit(0);
}

const code = fs.readFileSync('public/index.dev.html.bak', 'utf8');
const startTag = '<script type="text/babel">';
const startIdx = code.indexOf(startTag) + startTag.length;
const endIdx = code.indexOf('</script>', startIdx);
const jsxCode = code.substring(startIdx, endIdx);

try {
  babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });
  console.log('Backup compiles successfully!');
} catch (e) {
  console.error('Backup compile error:');
  console.error(e.message);
}
