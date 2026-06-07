import subprocess
import sys

NGINX_CONF = '/etc/nginx/sites-available/maiti-godoy-portal'

with open(NGINX_CONF, 'r') as f:
    c = f.read()

old = "        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }\n\n    location / {"
new = """        proxy_intercept_errors on;
        error_page 500 502 503 504 /error.html;
    }

    # G5X CRM
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
        proxy_intercept_errors on;
        error_page 500 502 503 504 /error.html;
    }

    location / {"""

c = c.replace(old, new)

with open(NGINX_CONF + '.tmp', 'w') as f:
    f.write(c)

# Validate nginx syntax before applying
result = subprocess.run(['nginx', '-t', '-c', NGINX_CONF + '.tmp'],
                       capture_output=True, text=True)
if result.returncode != 0:
    print(f'❌ NGINX config INVALID: {result.stderr}')
    sys.exit(1)

# Apply config
subprocess.run(['cp', NGINX_CONF + '.tmp', NGINX_CONF], check=True)
subprocess.run(['rm', NGINX_CONF + '.tmp'], check=True)

# Reload nginx
subprocess.run(['nginx', '-s', 'reload'], check=True)
print('✅ Nginx config applied and reloaded successfully')
