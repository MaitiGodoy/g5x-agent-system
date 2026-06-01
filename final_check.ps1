$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'
$remoteDir = '/root/g5x-agent-system'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  G5X - VERIFICACAO COMPLETA FINAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Check containers
Write-Host "`n[1/6] Docker containers..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep g5x"

# 2. Check port 3000 binding
Write-Host "`n[2/6] Port 3000 binding..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "netstat -tulpn | grep 3000"

# 3. Check internal HTTP response
Write-Host "`n[3/6] Internal HTTP health check..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "curl -s -o /dev/null -w 'HTTP %{http_code} - %{size_download} bytes - %{time_total}s' http://localhost:3000/"

# 4. Check API health
Write-Host "`n[4/6] API health check..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "curl -s http://localhost:3000/health"

# 5. Check LLM keys
Write-Host "`n[5/6] LLM keys and agent status..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker logs g5x-server --tail 15 2>&1 | grep -E 'LLM|Engine|API Keys|Servidor'"

# 6. Start agent and check
Write-Host "`n[6/6] Starting agent (Madalena)..." -ForegroundColor Yellow
$startResult = ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker exec g5x-server node -e `"const http=require('http');const r=http.request({host:'localhost',port:3000,path:'/api/agent/start',method:'POST'},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d))});r.end()`""
Write-Host $startResult

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  VERIFICACAO COMPLETA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nAcesse: http://2.24.71.246:3000" -ForegroundColor Cyan
Write-Host "(Se timeout, libere porta 3000 no firewall da Hostinger)`n" -ForegroundColor DarkYellow
