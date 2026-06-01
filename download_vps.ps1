$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

Write-Host "Downloading index.html from VPS..."
scp -o StrictHostKeyChecking=no -i "C:\Users\user\.ssh\id_ed25519" root@2.24.71.246:/root/g5x-agent-system/public/index.html public/index.html.vps
if ($LastExitCode -eq 0) {
    Write-Host "Success!"
} else {
    Write-Host "Failed with exit code $LastExitCode"
}
