const fs = require('fs');

const vps = fs.readFileSync('public/index.html.vps', 'utf8');
const local = fs.readFileSync('public/index.html', 'utf8');

console.log('VPS size:', vps.length);
console.log('Local size:', local.length);

// Let's find unique strings or words that appear in VPS but not local
const words = ['obStages', 'handleObLeadDrop', 'simulateReply', 'manualMigrate', 'stateRef', 'chatSending'];
words.forEach(w => {
  console.log(`Word '${w}': VPS has ${(vps.match(new RegExp(w, 'g')) || []).length}, Local has ${(local.match(new RegExp(w, 'g')) || []).length}`);
});

// Print some differences
if (vps !== local) {
  console.log('\nFiles are different. Finding first difference...');
  let diffIdx = -1;
  for (let i = 0; i < Math.min(vps.length, local.length); i++) {
    if (vps[i] !== local[i]) {
      diffIdx = i;
      break;
    }
  }
  if (diffIdx > -1) {
    console.log(`First difference at index ${diffIdx}:`);
    console.log('VPS context:', JSON.stringify(vps.substring(diffIdx, diffIdx + 200)));
    console.log('Local context:', JSON.stringify(local.substring(diffIdx, diffIdx + 200)));
  }
} else {
  console.log('Files are identical!');
}
