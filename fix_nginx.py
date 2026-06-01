import re

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'r') as f:
    content = f.read()

# Update error_page in Aura block
content = content.replace(
    '    error_page 502 503 504 /error.html;',
    '    proxy_intercept_errors on;\n    error_page 500 502 503 504 /error.html;'
)

# Add proxy_intercept_errors to Aura's evolution location
content = content.replace(
    "        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }\n\n# Maiti Godoy Portal",
    "        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n    }\n\n# Maiti Godoy Portal"
)

# Add proxy_intercept_errors and error_page to HTTP CRM location
content = content.replace(
    "location /crm/ {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }",
    "location /crm/ {\n        proxy_pass http://127.0.0.1:3000/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }"
)

# Add proxy_intercept_errors and error_page to HTTP Evolution location
content = content.replace(
    "location /evolution/ {\n        proxy_pass http://127.0.0.1:8081/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n    }",
    "location /evolution/ {\n        proxy_pass http://127.0.0.1:8081/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_intercept_errors on;\n        error_page 500 502 503 504 /error.html;\n    }"
)

# Add error_page location to HTTP block (before the closing })
# The HTTP block ends with:
#     location / {
#         return 301 https://$host$request_uri;
#     }
# }
content = content.replace(
    "    location / {\n        return 301 https://$host$request_uri;\n    }\n}",
    "    location / {\n        return 301 https://$host$request_uri;\n    }\n\n    error_page 500 502 503 504 /error.html;\n    location = /error.html {\n        root /var/www/error-page;\n        internal;\n    }\n}"
)

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'w') as f:
    f.write(content)
print('OK')
