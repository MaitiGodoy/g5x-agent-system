$env:SSH_ASKPASS = 'C:\Users\user\Downloads\g5x antigracity\g5x-agent-system\pass.bat'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'd'
$env:TEMP_PASSPHRASE = 'your_ssh_passphrase'

$ip = '2.24.71.246'
$identity = 'C:\Users\user\.ssh\id_ed25519'

# Step 1: Remove conflicting separate config, add /crm location into the existing port-80 server block
Write-Host "[1/5] Fixing Nginx config (single server block approach)..." -ForegroundColor Yellow

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "rm -f /etc/nginx/sites-enabled/g5x-crm /etc/nginx/sites-available/g5x-crm"

# Rewrite the maiti-godoy-portal config to include /crm reverse proxy in the port 80 block
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" @"
cat > /etc/nginx/sites-available/maiti-godoy-portal << 'NGINXEOF'
server {
    listen 80;
    server_name srv1643706.hstgr.cloud 2.24.71.246 maitigodoy.com.br www.maitigodoy.com.br;

    # G5X CRM reverse proxy on /crm
    location /crm {
        rewrite ^/crm`$ /crm/ permanent;
    }

    location /crm/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Redirecionar todo o resto HTTP para HTTPS
    location / {
        return 301 https://`$host`$request_uri;
    }
}

# Site Maiti Godoy Portal
server {
    listen 443 ssl;
    server_name maitigodoy.com.br www.maitigodoy.com.br;

    ssl_certificate /etc/letsencrypt/live/maitigodoy.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maitigodoy.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/maiti-godoy-portal;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files `$uri `$uri/ /index.html;
    }

    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|webp|woff|woff2|ttf|otf|json)`$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }

    error_page 404 /index.html;
}

# Aura Application (Padrao para IP / srv1643706.hstgr.cloud)
server {
    listen 443 ssl default_server;
    server_name srv1643706.hstgr.cloud 2.24.71.246;

    ssl_certificate /opt/aura/ssl/selfsigned.crt;
    ssl_certificate_key /opt/aura/ssl/selfsigned.key;

    location / {
        proxy_pass https://127.0.0.1:8443;
        proxy_ssl_verify off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
}
NGINXEOF
"@

Write-Host "[2/5] Testing Nginx config..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "nginx -t 2>&1"

Write-Host "[3/5] Reloading Nginx..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "systemctl reload nginx && echo 'OK'"

# Step 2: Set agent_config.running=true FIRST, then start
Write-Host "`n[4/5] Updating agent config and starting engine..." -ForegroundColor Yellow

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" @"
cat > /root/g5x-agent-system/start_agent_helper.js << 'JSEOF'
const http = require('http');
function httpReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { host: 'localhost', port: 3000, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
(async () => {
  // Set running=true FIRST so heartbeat doesn't auto-stop
  console.log('1. Setting agent_config.running=true...');
  await httpReq('PUT', '/api/agent-config', { running: true });
  console.log('   Done');

  console.log('2. Starting engine...');
  const r = await httpReq('POST', '/api/agent/start');
  console.log('   Result:', r.success ? 'OK' : 'Already running');

  // Wait 3s for heartbeat
  await new Promise(r => setTimeout(r, 3000));

  console.log('3. Final status...');
  const s = await httpReq('GET', '/api/agent/status');
  console.log('   Running:', s.running, '| Status:', s.status, '| Heartbeats:', s.heartbeatCount);
})();
JSEOF
"@

ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "docker exec g5x-server node /app/data/start_agent_helper.js"

# Step 3: Quick access test via Nginx
Write-Host "`n[5/5] Testing access via Nginx /crm/..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $identity "root@$ip" "curl -s -o /dev/null -w 'HTTP %{http_code} - %{size_download} bytes' http://localhost/crm/"

Write-Host "`n`n========================================" -ForegroundColor Green
Write-Host "  TUDO FINALIZADO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "CRM: http://2.24.71.246/crm/" -ForegroundColor Cyan
