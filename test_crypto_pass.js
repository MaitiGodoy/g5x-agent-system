const fs = require('fs');
const crypto = require('crypto');

const keyPath = 'C:\\Users\\user\\.ssh\\id_ed25519';
const keyData = fs.readFileSync(keyPath);

const candidates = [
  '@Sh48151623#',
  'Sh4815162342#',
  'root@Sh4815162342#',
  'Sh48151623#',
  'Sh4815162342',
  '@Sh4815162342#',
  'root@Sh48151623#',
  'maiti.godoy@gmail.com',
  'maiti.godoy@hotmail.com'
];

for (let pass of candidates) {
  try {
    crypto.createPrivateKey({ key: keyData, passphrase: pass });
    console.log(`✅ Node Crypto SUCCESS! id_ed25519 passphrase is: "${pass}"`);
    process.exit(0);
  } catch (e) {
    // console.log(`❌ Failed: "${pass}" - ${e.message}`);
  }
}

console.log("❌ None of the candidates worked in Node Crypto.");
