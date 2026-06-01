# 🎯 G5X MASTER OS - Quick Reference

## ✅ Correções Aplicadas (v25 Estável)

| Bug | Status | Descrição |
|-----|--------|-----------|
| Lead Cards não apareciam | ✅ FIX | React.createElement nesting corrigido com children[] + spread |
| Chat perdia foco | ✅ FIX | Convertido para controlled component (chatInputValue state) |
| Debug overlay verde | ✅ REMOVIDO | Texto "Leads: X | Filtrados: X..." removido |
| Console.logs debug | ✅ LIMPO | Logs de debug removidos |

## 🚀 Deploy Rápido

### Windows (Local)
```powershell
cd "g5x antigracity\g5x-agent-system"
.\deploy.bat
```

### Linux (VPS)
```bash
cd /opt/g5x-agent-system
chmod +x deploy.sh
./deploy.sh
```

### Manual
```bash
docker-compose up -d --build
```

## 📁 Estrutura de Arquivos

```
g5x-agent-system/
├── public/
│   ├── index.html          # Frontend React (com fixes)
│   ├── bridge.js           # API Bridge
│   └── debug_jsx.js        # Versão dev (não usada em prod)
├── server.js               # Servidor Express
├── api.js                  # Rotas API
├── agent.js                # Agente autônomo
├── queue.js                # BullMQ queue
├── tools/
│   ├── llm.js              # Integração IA
│   └── rag.js              # RAG system
├── mcps/                   # MCP servers
├── Dockerfile              # Docker config
├── docker-compose.yml      # Orquestração
├── .dockerignore           # Exclude files
├── .env.example            # Template env
├── package.json            # Dependencies
├── DEPLOY.md               # Guia completo
├── deploy.sh               # Script Linux
└── deploy.bat              # Script Windows
```

## 🔧 Configuração Mínima (.env)

```env
DEEPSEEK_API_KEY=sua_chave
GROQ_API_KEY=sua_chave
PORT=3000
```

## 📊 Verificação Post-Deploy

1. **Health Check**: `curl http://localhost:3000/health`
2. **UI**: Abrir `http://localhost:3000` no navegador
3. **Kanban**: Verificar se Lead Cards aparecem
4. **Chat**: Testar digitação sem perda de foco

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Container não sobe | `docker-compose logs g5x-server` |
| Porta em uso | Mudar `PORT=3001` no `.env` |
| Redis falha | `docker-compose restart redis` |
| Dados perdidos | Verificar volumes: `docker volume ls` |

## 📞 Suporte

- Logs: `docker-compose logs -f`
- Acessar container: `docker exec -it g5x-server sh`
- Backup: `docker run --rm -v g5x-data:/data -v $(pwd):/backup alpine tar czf /backup/g5x-data.tar.gz -C /data .`
