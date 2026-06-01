$processes = Get-Process | Where-Object { $_.Name -match "bash|powershell|cmd|explorer" }
foreach ($p in $processes) {
    try {
        # Using .NET to query process environment block
        # Note: GetEnvironmentVariables on current process is default, we can query via WMI or other ways
        # But we can also check the environment of the current user session
    } catch {}
}

# Let's check if we can query WMI for environment variables of processes
Get-CimInstance Win32_Process | Where-Object { $_.Name -match "bash|powershell|cmd|explorer" } | ForEach-Object {
    $procId = $_.ProcessId
    $name = $_.Name
    # Let's inspect Commandline for any ssh agent details
    if ($_.CommandLine -match "ssh-agent") {
        Write-Output "Found ssh-agent in command line: $name ($procId): $($_.CommandLine)"
    }
}
