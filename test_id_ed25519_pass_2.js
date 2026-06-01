const fs = require('fs');
const crypto = require('crypto');

const keyPath = 'C:\\Users\\user\\.ssh\\id_ed25519';
const keyData = fs.readFileSync(keyPath);

const candidates = [
  'maiti',
  'maiti.godoy',
  'godoy',
  'maitigodoy',
  'maitig',
  'emerson',
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
  'GericFast2026'
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

console.log("❌ None of the extended candidates worked for id_ed25519.");
