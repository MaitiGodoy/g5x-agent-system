#!/bin/bash
# Check status
echo "=== STATUS ==="
curl -s http://localhost:8081/instance/fetchInstances -H "apikey: g5x-evolution-key-2026" | python3 -c 'import sys,json
for i in json.load(sys.stdin):
    print(i["name"], i["connectionStatus"])'

# Generate fresh QR
echo "=== QR ==="
curl -s http://localhost:8081/instance/connect/g5x-agent -H "apikey: g5x-evolution-key-2026" | python3 -c 'import sys,json,base64
d=json.load(sys.stdin)
if d.get("pairingCode"):
    print("PAIRING CODE:", d["pairingCode"])
if d.get("base64"):
    img=base64.b64decode(d["base64"].split(",")[1])
    open("/opt/evolution/qrcode.png","wb").write(img)
    print("QR salvo, bytes:", len(img))
print("keys:", list(d.keys()))
'
