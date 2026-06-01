#!/bin/bash
# Adiciona location /evolution/ no nginx HTTP (porta 80)
sed -i '/location \/crm\/ {/,/}/a\
\
    location /evolution/ {\
        proxy_pass http://127.0.0.1:8081/;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_cache_bypass $http_upgrade;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' /etc/nginx/sites-enabled/maiti-godoy-portal

# Test config and reload
nginx -t && systemctl reload nginx
echo "Nginx reloaded"
