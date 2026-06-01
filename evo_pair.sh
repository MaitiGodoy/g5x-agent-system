#!/bin/bash
curl -s http://localhost:8081/instance/connect/g5x-agent -H "apikey: g5x-evolution-key-2026" | python3 -c '
import sys, json, base64
d = json.load(sys.stdin)
img = base64.b64decode(d["base64"].split(",")[1])
with open("/opt/evolution/qrcode.png", "wb") as f:
    f.write(img)
print("QR Code atualizado")
'
