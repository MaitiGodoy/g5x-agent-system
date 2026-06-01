const fs = require('fs');

const code = fs.readFileSync('public/index.html.vps', 'utf8');

console.log('=== stateRef Assignment ===');
const stateRefMatch = code.match(/stateRef\.current\s*=\s*\{([\s\S]*?)\};/);
if (stateRefMatch) {
  console.log(stateRefMatch[0].substring(0, 500) + '\n...');
} else {
  console.log('stateRef.current not found');
}

console.log('\n=== ObPipelineColumn ===');
const opcIdx = code.indexOf('const ObPipelineColumn');
if (opcIdx > -1) {
  console.log(code.substring(opcIdx, opcIdx + 1000));
} else {
  console.log('ObPipelineColumn not found');
}

console.log('\n=== handleObLeadDrop ===');
const holdIdx = code.indexOf('handleObLeadDrop');
if (holdIdx > -1) {
  console.log(code.substring(holdIdx - 100, holdIdx + 600));
} else {
  console.log('handleObLeadDrop not found');
}
