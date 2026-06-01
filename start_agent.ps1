$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

# 1. Start the agent
Write-Host "[1/3] Starting agent (Madalena)..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" 'docker exec g5x-server node -e "const http=require(\"http\");const r=http.request({host:\"localhost\",port:3000,path:\"/api/agent/start\",method:\"POST\"},res=>{let d=\"\";res.on(\"data\",c=>d+=c);res.on(\"end\",()=>console.log(d))});r.end()"'

# 2. Set agent config running=true in DB so it stays running after heartbeat
Write-Host "`n[2/3] Setting agent_config.running=true..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" 'docker exec g5x-server node -e "const http=require(\"http\");const data=JSON.stringify({running:true});const r=http.request({host:\"localhost\",port:3000,path:\"/api/agent-config\",method:\"PUT\",headers:{\"Content-Type\":\"application/json\",\"Content-Length\":data.length}},res=>{let d=\"\";res.on(\"data\",c=>d+=c);res.on(\"end\",()=>console.log(d))});r.write(data);r.end()"'

# 3. Verify agent status
Write-Host "`n[3/3] Checking agent status..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" 'docker exec g5x-server node -e "const http=require(\"http\");http.get(\"http://localhost:3000/api/agent/status\",res=>{let d=\"\";res.on(\"data\",c=>d+=c);res.on(\"end\",()=>console.log(d))})"'
