$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

Write-Host "Checking UFW status on VPS..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "ufw status"

Write-Host "`nChecking iptables rules on VPS..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "iptables -L -n -v | grep -i 3000"
