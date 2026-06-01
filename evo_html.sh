#!/bin/bash
curl -s http://localhost:8081/instance/connect/g5x -H "apikey: g5x-evolution-key-2026" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print("keys:", list(d.keys()))
if "base64" in d:
    b64 = d["base64"]
    html = "<!DOCTYPE html><html><head><title>QR</title></head><body style=\"display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#111\"><div style=\"text-align:center\"><h2 style=\"color:white\">Escaneie com WhatsApp</h2><img src=\"" + b64 + "\" style=\"width:300px;height:300px;border:4px solid white;border-radius:10px\"><p style=\"color:#aaa\">QR expira em ~20s. Atualize F5.</p><p style=\"color:#aaa\">Aparelhos Conectados > Conectar aparelho</p></div></body></html>"
    with open("/opt/evolution/qrcode.html", "w") as f:
        f.write(html)
    print("HTML salvo OK")
else:
    print("ERRO:", d)
'
