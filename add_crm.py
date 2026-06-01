with open('/etc/nginx/sites-available/maiti-godoy-portal', 'r') as f:
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

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'w') as f:
    f.write(c)
print('OK')
