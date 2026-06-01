import re

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'r') as f:
    c = f.read()

# ===== ADD SERVER-LEVEL error_page + location TO AURA BLOCK =====
# Current Aura block ends with:
#     location / { ... proxy_intercept_errors on; }
# }
# We need to add between the location / closing brace and server closing brace

old = """        proxy_intercept_errors on;
    }
}"""

new = """        proxy_intercept_errors on;
    }

    error_page 500 502 503 504 /error.html;
    location = /error.html {
        root /var/www/error-page;
        internal;
    }
}"""

if old in c:
    c = c.replace(old, new)
    print('Aura error_page added')
else:
    print('Aura end pattern not found!')
    # Debug: show last 200 chars
    print(repr(c[-200:]))

with open('/etc/nginx/sites-available/maiti-godoy-portal', 'w') as f:
    f.write(c)
print('DONE')
