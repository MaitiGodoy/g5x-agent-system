const { exec } = require('child_process');

const users = ['root', 'ubuntu', 'admin', 'maitig', 'emerson', 'debian'];

function tryNext(idx) {
  if (idx >= users.length) {
    console.log('All usernames failed.');
    process.exit(1);
  }
  const u = users[idx];
  const cmd = `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=3 -i C:\\Users\\user\\.ssh\\id_ed25519_vps ${u}@2.24.71.246 "echo OK"`;
  
  exec(cmd, (err, stdout, stderr) => {
    if (!err && stdout.includes('OK')) {
      console.log(`✅ SUCCESSFUL USERNAME: ${u}`);
      process.exit(0);
    } else {
      console.log(`❌ Failed ${u}:`, (stderr || err.message).trim());
      tryNext(idx + 1);
    }
  });
}

tryNext(0);
