const { execFile } = require('child_process');
const path = require('path');

const BRIDGE_SCRIPT = '/app/tools/doutor-bridge.py';
const PYTHON_CMD = 'python3';

const payload = JSON.stringify({
  action: 'chat',
  params: {
    messages: [{ role: 'user', content: 'Ola' }],
    timeout: 60000
  }
});

console.log('Payload length:', payload.length);
console.log('Payload:', payload.substring(0, 200));

execFile(
  PYTHON_CMD,
  [BRIDGE_SCRIPT, payload],
  {
    timeout: 65000,
    maxBuffer: 1024 * 1024 * 5,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  },
  (error, stdout, stderr) => {
    if (error) {
      console.log('Error:', error.message);
      console.log('Stderr:', stderr);
    }
    console.log('Stdout:', stdout);
  }
);
