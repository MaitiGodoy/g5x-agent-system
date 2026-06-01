$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'

$keys = @('C:\Users\user\.ssh\id_ed25519', 'C:\Users\user\.ssh\id_ed25519_vps')
$passes = @('@Sh48151623#', 'your_ssh_passphrase', 'rootyour_ssh_passphrase', 'your_ssh_passphrase', 'Sh48151623#', 'Sh4815162342', 'root@Sh48151623#')

foreach ($k in $keys) {
    foreach ($p in $passes) {
        $env:TEMP_PASSPHRASE = $p
        Write-Output "Testing Key: $k | Passphrase: $p"
        
        # Capture stdout and stderr
        $res = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 -i $k root@2.24.71.246 "echo SUCCESS_SSH" 2>&1
        $resStr = [string]$res
        if ($resStr -match "SUCCESS_SSH") {
            Write-Output "🎉 SUCCESS! FOUND WORKING SSH CONFIG!"
            Write-Output "Key: $k"
            Write-Output "Passphrase: $p"
            exit 0
        } else {
            # Trim output for display
            $msg = ($resStr -split "`r?`n")[0]
            Write-Output "  Result: $msg"
        }
    }
}

Write-Output "❌ All attempts failed."
exit 1
