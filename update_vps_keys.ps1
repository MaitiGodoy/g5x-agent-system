$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'
$remoteDir = '/root/g5x-agent-system'

Write-Host "Updating VPS env with active keys..."
$envContent = @"
# Preencha suas chaves aqui (ou use o .env local)
DEEPSEEK_API_KEY=your_deepseek_key
GROQ_API_KEY=your_groq_key
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=g5x_crm
REDIS_HOST=redis
REDIS_PORT=6379
PORT=3000
AGENT_AUTO_START=true
AGENT_HEARTBEAT_SECONDS=120
AGENT_MAX_PER_CYCLE=5
DATA_DIR=/app/data
UPLOAD_DIR=/app/uploads
"@

# Write .env file to VPS
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cat << 'EOF' > $remoteDir/.env`n$envContent`nEOF"
Write-Host "Env keys updated!"

# Upload updated public/index.html
Write-Host "Uploading updated public/index.html..."
scp -O -o StrictHostKeyChecking=no -i $identity public/index.html "root@${ip}:${remoteDir}/public/index.html"

# Restart containers to load new env
Write-Host "Restarting containers on VPS..."
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cd $remoteDir && docker compose restart"

# Wait for boot
Write-Host "Waiting 8 seconds for containers to restart..."
Start-Sleep -Seconds 8

# Run diagnostics
Write-Host "Running diagnostics check..."
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker exec g5x-server node /app/data/test_diagnostic.js"
