$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

Write-Host "[1/4] Uploading Nginx config via SCP..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no -i $identity "nginx_maiti_godoy_portal.conf" "root@${ip}:/etc/nginx/sites-available/maiti-godoy-portal"

Write-Host "[2/4] Removing old g5x-crm config..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "rm -f /etc/nginx/sites-enabled/g5x-crm /etc/nginx/sites-available/g5x-crm"

Write-Host "[3/4] Testing Nginx..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "nginx -t 2>&1"

Write-Host "[4/4] Reloading Nginx..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "systemctl reload nginx && echo 'Nginx reloaded successfully!'"

Write-Host "`n[BONUS] Testing /crm/ via localhost..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "curl -s -o /dev/null -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost/crm/"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  NGINX CONFIGURADO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Acesse: http://2.24.71.246/crm/" -ForegroundColor Cyan
