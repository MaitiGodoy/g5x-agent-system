#!/bin/bash
sleep 3

echo "=== CREATE NEW ==="
curl -s -X POST http://localhost:8081/instance/create -H "apikey: g5x-evolution-key-2026" -H "Content-Type: application/json" -d '{"instanceName":"g5x","qrcode":true,"integration":"WHATSAPP-BAILEYS"}' --max-time 10
echo ""

echo "=== CONNECT NUMBER ==="
curl -s "http://localhost:8081/instance/connect/g5x?number=5511941456607" -H "apikey: g5x-evolution-key-2026" --max-time 10
echo ""
