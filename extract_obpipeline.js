const fs = require('fs');

const code = fs.readFileSync('public/index.html.vps', 'utf8');

const opIdx = code.indexOf('const ObPipeline =');
if (opIdx > -1) {
  // Print 3000 chars of ObPipeline from VPS
  console.log('=== ObPipeline in VPS ===');
  console.log(code.substring(opIdx, opIdx + 3000));
} else {
  console.log('ObPipeline not found in VPS');
}

const ocIdx = code.indexOf('const ObCard =');
if (ocIdx > -1) {
  console.log('=== ObCard in VPS ===');
  console.log(code.substring(ocIdx, ocIdx + 1000));
} else {
  console.log('ObCard not found in VPS');
}
