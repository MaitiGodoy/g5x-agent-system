const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('public/index.dev.html', 'utf8');
const startTag = '<script type="text/babel">';
const startIdx = code.indexOf(startTag) + startTag.length;
const endIdx = code.indexOf('</script>', startIdx);
const jsxCode = code.substring(startIdx, endIdx);

try {
  babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });
  console.log('Success!');
} catch (e) {
  console.error('Full Babel Error:');
  console.error(e.message);
}
