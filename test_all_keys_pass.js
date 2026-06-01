const fs = require('fs');
const crypto = require('crypto');

const keys = [
  'C:\\Users\\user\\.ssh\\id_ed25519',
  'C:\\Users\\user\\.ssh\\id_ed25519_vps'
];

const passphrases = [
  '@Sh48151623#',
  'Sh4815162342#',
  'root@Sh4815162342#',
  'Sh48151623#',
  'Sh4815162342',
  '@Sh4815162342#',
  'root@Sh48151623#',
  'maiti.godoy@gmail.com',
  'maiti.godoy@hotmail.com',
  'emerson_abab@hotmail.com',
  '02omjuqhnoqfqaud',
  'FastGERIC',
  'NexusG5X',
  'G5XFast',
  'Fast123',
  'Fast2026',
  'G5X2026',
  'GericFast2026',
  'maiti',
  'emerson',
  'root',
  'admin',
  '4815162342',
  '@4815162342#',
  '4815162342#',
  'lost',
  'lost4815162342',
  '@Lost4815162342#'
];

for (let keyPath of keys) {
  const keyData = fs.readFileSync(keyPath);
  console.log(`Testing key: ${keyPath}`);
  for (let pass of passphrases) {
    try {
      crypto.createPrivateKey({ key: keyData, passphrase: pass });
      console.log(`  🎉 SUCCESS! Key: ${keyPath} | Passphrase: "${pass}"`);
    } catch (e) {
      // console.log(`  Fail: "${pass}" - ${e.message}`);
    }
  }
}
