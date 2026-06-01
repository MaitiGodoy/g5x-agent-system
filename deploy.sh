#!/bin/bash
# ═══════════════════════════════════════════
# G5X MASTER OS - Deploy Script
# ═══════════════════════════════════════════

set -e

echo "🚀 G5X MASTER OS - Deploy na VPS"
echo "================================"

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instale primeiro:"
    echo "   curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado. Instale primeiro:"
    echo "   sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose"
    echo "   sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

echo "✅ Docker e Docker Compose encontrados"

# Criar .env se não existir
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado. Copiando do exemplo..."
    cp .env.example .env
    echo "📝 Edite o arquivo .env com suas credenciais antes de continuar!"
    echo "   nano .env"
    exit 1
fi

echo "📦 Construindo containers..."
docker-compose up -d --build

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "🌐 Acesse o CRM em: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 Comandos úteis:"
echo "   Ver logs: docker-compose logs -f"
echo "   Parar: docker-compose down"
echo "   Reiniciar: docker-compose restart"
echo ""
echo "🔍 Health check: curl http://localhost:3000/health"
