with open('/etc/nginx/sites-available/maiti-godoy-portal', 'r') as f:
    c = f.read()

# 1. Replace error_page 502/503/504 with 500/502/503/504 + proxy_intercept_errors
c = c.replace(
    '    error_page 502 503 504 /error.html;',
    '    proxy_intercept_errors on;\n    error_page 500 502 503 504 /error.html;'
)

# 2. Add proxy_intercept_errors to Aura evolution
c = c.replace(
    "        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }\n\n# Maiti Godoy Portal",
    "        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n    }\n\n# Maiti Godoy Portal"
)

# 3. Add proxy_intercept_errors + error_page to HTTP CRM 
old_crm = "location /crm/ {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }"
new_crm = "location /crm/ {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }"
c = c.replace(old_crm, new_crm)

# 4. Add proxy_intercept_errors + error_page to HTTP Evolution
old_evol = "location /evolution/ {\n        proxy_pass http://127.0.0.1:8081/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }"
new_evol = "location /evolution/ {\n        proxy_pass http://127.0.0.1:8081/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }"
c = c.replace(old_evol, new_evol)

# 5. Add error_page location to HTTP block
c = c.replace(
    "    location / {\n        return 301 https://$host$request_uri;\n    }\n}",
    "    location / {\n        return 301 https://$host$request_uri;\n    }\n\n    error_page 500 502 503 504 /error.html;\n    location = /error.html {\n        root /var/www/error-page;\n        internal;\n    }\n}"
)

# 6. Add CRM location to Aura HTTPS block 
old_aura = "        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }\n\n    location / {"
new_aura = """        proxy_intercept_errors on;
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
c = c.replace(old_aura, new_aura)

# 7. Add proxy_intercept_errors inside Aura's location / block
c = c.replace(
    "    location / {\n        proxy_pass https://127.0.0.1:8443;\n        proxy_ssl_verify off;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }",
    "    location / {\n        proxy_pass https://127.0.0.1:8443;\n        proxy_ssl_verify off;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_intercept_errors on;\n    }"
)

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'w') as f:
    f.write(c)
print('OK')
