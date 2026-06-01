$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'
$remoteDir = '/root/g5x-agent-system'

Write-Host "1. Stopping docker compose containers..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cd $remoteDir && docker compose down"

Write-Host "2. Double checking if any process is STILL on port 3000..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "netstat -tulpn | grep 3000"
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "fuser -k 3000/tcp"

Write-Host "3. Starting docker compose containers..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cd $remoteDir && docker compose up -d"

Write-Host "4. Showing docker ps output..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker ps"

Write-Host "5. Checking port 3000 listening processes on host..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "netstat -tulpn | grep 3000"
