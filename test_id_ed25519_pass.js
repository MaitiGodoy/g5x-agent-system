const fs = require('fs');
const crypto = require('crypto');

const keyPath = 'C:\\Users\\user\\.ssh\\id_ed25519';
const keyData = fs.readFileSync(keyPath);

const candidates = [
  '',
  'g5x',
  'g5x-agent-system',
  'g5x_antigracity',
  'nexus',
  'opencode',
  'root',
  'admin',
  'antigravity',
  'fast',
  'geric'
];

for (let pass of candidates) {
  try {
    crypto.createPrivateKey({ key: keyData, passphrase: pass });
    console.log(`✅ SUCCESS! id_ed25519 passphrase is: "${pass}"`);
    process.exit(0);
  } catch (e) {
    // console.log(`❌ Failed: "${pass}" - ${e.message}`);
  }
}

console.log("❌ None of the basic candidates worked for id_ed25519.");
