$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

# Create Nginx config for G5X CRM on /crm path
Write-Host "[1/2] Adding G5X CRM reverse proxy to Nginx..." -ForegroundColor Yellow

$nginxConfig = @'
# G5X CRM - Reverse Proxy via /crm
location /crm/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
'@

# Instead of modifying existing config, let's create a dedicated server block on port 3000
# Actually, simplest approach: add a direct location block to the existing default server
# But the existing config redirects port 80 to HTTPS. Let's create a separate server for CRM on port 80

$crmConfig = @'
# G5X CRM - Direct access on port 80 via /crm
server {
    listen 80;
    server_name 2.24.71.246 srv1643706.hstgr.cloud;

    location /crm {
        rewrite ^/crm$ /crm/ permanent;
    }

    location /crm/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Keep the redirect to HTTPS for non-CRM paths
    location / {
        return 301 https://$host$request_uri;
    }
}
'@

# Write the config and reload nginx
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "cat > /etc/nginx/sites-available/g5x-crm << 'NGINXEOF'
$crmConfig
NGINXEOF"

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "ln -sf /etc/nginx/sites-available/g5x-crm /etc/nginx/sites-enabled/g5x-crm"

# Remove the conflicting default redirect for port 80 from the maiti-godoy-portal config
# The existing config has a catch-all server block for port 80 that redirects everything to HTTPS
# We need to remove the IP from that block so our g5x-crm block handles it
Write-Host "[2/2] Testing and reloading Nginx..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "nginx -t 2>&1"
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "systemctl reload nginx"

Write-Host "`nDone! CRM accessible at: http://2.24.71.246/crm/" -ForegroundColor Green
