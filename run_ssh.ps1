$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

# Upload the updated llm.js
Write-Host "Uploading updated llm.js..."
scp -O -o StrictHostKeyChecking=no -i C:\Users\user\.ssh\id_ed25519 tools/llm.js root@2.24.71.246:/root/g5x-agent-system/tools/llm.js

# Rebuild and start
Write-Host "`nRebuilding and starting containers..."
ssh -o StrictHostKeyChecking=no -i C:\Users\user\.ssh\id_ed25519 root@2.24.71.246 'cd /root/g5x-agent-system && docker compose down && docker compose build && docker compose up -d'

# Wait for boot
Write-Host "`nWaiting 12 seconds for containers to start..."
Start-Sleep -Seconds 12

# Run diagnostic
ssh -o StrictHostKeyChecking=no -i C:\Users\user\.ssh\id_ed25519 root@2.24.71.246 'docker exec g5x-server node /app/data/test_diagnostic.js'
