$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x-antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
ssh -o StrictHostKeyChecking=no -i C:\Users\user\.ssh\id_ed25519_vps root@2.24.71.246 "echo OK"
