$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

Write-Host "Checking all docker containers..."
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker ps -a"

Write-Host "`nGetting logs of g5x-server..."
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker logs g5x-server --tail 30"
