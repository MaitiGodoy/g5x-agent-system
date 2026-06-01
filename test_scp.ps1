$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

Write-Output "Testing SCP with legacy -O flag..."
scp -O -o StrictHostKeyChecking=no -i C:\Users\user\.ssh\id_ed25519 api.js root@2.24.71.246:/root/g5x-agent-system/api.js.tmp
