# Set environment variables for automatic SSH/SCP key unlocking
$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'
$remoteDir = '/root/g5x-agent-system'

Write-Host "================ G5X VPS ARCHIVE DEPLOYMENT ================" -ForegroundColor Cyan

# 1. Prepare local files for archive
Write-Host "[1/6] Preparing local files in deploy_temp directory..." -ForegroundColor Yellow
if (Test-Path deploy_temp) { Remove-Item -Recurse -Force deploy_temp }
if (Test-Path deploy.tar.gz) { Remove-Item -Force deploy.tar.gz }

New-Item -ItemType Directory -Path deploy_temp | Out-Null
New-Item -ItemType Directory -Path deploy_temp/public | Out-Null
New-Item -ItemType Directory -Path deploy_temp/tools | Out-Null

Copy-Item "api.js" "deploy_temp/"
Copy-Item "agent.js" "deploy_temp/"
Copy-Item "server.js" "deploy_temp/"
Copy-Item "package.json" "deploy_temp/"
Copy-Item "public/index.html" "deploy_temp/public/"
Copy-Item "public/bridge.js" "deploy_temp/public/"
Copy-Item "tools/llm.js" "deploy_temp/tools/"
Copy-Item "tools/rag.js" "deploy_temp/tools/"
Copy-Item "tools/smart-import.js" "deploy_temp/tools/"
Copy-Item "tools/refactor_context.js" "deploy_temp/tools/"

# 2. Compress files using tar
Write-Host "[2/6] Compressing files into deploy.tar.gz..." -ForegroundColor Yellow
tar -czf deploy.tar.gz -C deploy_temp .
Write-Host "Archive created successfully!`n" -ForegroundColor Green

# 3. Upload archive to VPS (single SCP connection)
Write-Host "[3/6] Uploading archive to VPS..." -ForegroundColor Yellow
scp -O -o StrictHostKeyChecking=no -i $identity deploy.tar.gz "root@$($ip):$remoteDir/deploy.tar.gz"
Write-Host "Archive uploaded successfully!`n" -ForegroundColor Green

# 4. Stop containers, extract files and adjust port (single SSH connection block)
Write-Host "[4/6] Extracting archive and stopping/adjusting containers on VPS..." -ForegroundColor Yellow
$remoteCommands = @"
cd $remoteDir
docker compose down
tar -xzf deploy.tar.gz -C $remoteDir
rm -f deploy.tar.gz
sed -i 's/5432:5432/5433:5432/g' docker-compose.yml
"@

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" $remoteCommands
Write-Host "Remote files updated and prepared!`n" -ForegroundColor Green

# 5. Rebuild and start Docker containers
Write-Host "[5/6] Rebuilding and starting Docker containers on VPS..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cd $remoteDir && docker compose up -d --build"
Write-Host "Docker containers started!`n" -ForegroundColor Green

# 6. Run diagnostics inside g5x-server container
Write-Host "[6/6] Running diagnostic tests inside g5x-server container..." -ForegroundColor Yellow
Write-Host "Waiting 12 seconds for services to boot..."
Start-Sleep -Seconds 12

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker ps"
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker exec g5x-server node /app/data/test_diagnostic.js"

# Cleanup local temporary files
Remove-Item -Recurse -Force deploy_temp
Remove-Item -Force deploy.tar.gz

Write-Host "`nDeployment process completed successfully!" -ForegroundColor Green
