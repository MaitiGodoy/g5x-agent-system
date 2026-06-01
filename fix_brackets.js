const fs = require('fs');
const babel = require('@babel/core');

let html = fs.readFileSync('public/index.dev.html', 'utf8');

// Normalize line endings to LF first for reliable replacements
html = html.replace(/\r\n/g, '\n');

// Perform the replacements for missing closing braces
const replacements = [
  {
    target: ');\n\nconst LoadingScreen',
    replacement: ');\n};\n\nconst LoadingScreen'
  },
  {
    target: ');\n\nconst ObPipeline=()=>',
    replacement: ');\n};\n\nconst ObPipeline=()=>'
  },
  {
    target: ');\n\n// PARTE 7b — GELADEIRA',
    replacement: ');\n};\n\n// PARTE 7b — GELADEIRA'
  },
  {
    target: ');\n// PARTE 7c — CADÊNCIAS',
    replacement: ');\n};\n// PARTE 7c — CADÊNCIAS'
  },
  {
    target: ');\n\n// PARTE 7d — OUTBOUND VIEW',
    replacement: ');\n};\n\n// PARTE 7d — OUTBOUND VIEW'
  },
  {
    target: ');\n\n// PARTE 8b — AGENT LOG VIEW',
    replacement: ');\n};\n\n// PARTE 8b — AGENT LOG VIEW'
  },
  {
    target: ');\n\n// PARTE 8c — ACTIVITY LOG',
    replacement: ');\n};\n\n// PARTE 8c — ACTIVITY LOG'
  },
  {
    target: ');\n\n// ── Engine Dashboard ──',
    replacement: ');\n};\n\n// ── Engine Dashboard ──'
  },
  {
    target: ');\n\n// PARTE 10b — BI VIEW',
    replacement: ');\n};\n\n// PARTE 10b — BI VIEW'
  }
];

let replacedCount = 0;
replacements.forEach(r => {
  if (html.includes(r.target)) {
    html = html.replace(r.target, r.replacement);
    replacedCount++;
  } else {
    console.log(`⚠️ TARGET NOT FOUND: ${JSON.stringify(r.target)}`);
  }
});

console.log(`Made ${replacedCount} replacements.`);

// Convert line endings back to CRLF (standard on Windows)
html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('public/index.dev.html', html);

// Validate by running babel
const startTag = '<script type="text/babel">';
const startIdx = html.indexOf(startTag) + startTag.length;
const endIdx = html.indexOf('</script>', startIdx);
const jsxCode = html.substring(startIdx, endIdx);

try {
  babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });
  console.log('🎉 SUCCESS: index.dev.html compiled cleanly with Babel!');
} catch (e) {
  console.error('❌ COMPILE ERROR after fixes:');
  console.error(e.message);
}
