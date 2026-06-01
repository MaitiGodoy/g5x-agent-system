# 🚀 G5X MASTER OS - Deploy na VPS

## ✅ Versão Atual (v25 - Estável)

Esta versão contém todas as correções críticas:
- ✅ LeadCard: Corrigido bug de renderização no Kanban (children[] + spread)
- ✅ ChatView: Corrigido perda de foco (controlled component)
- ✅ Debug overlay removido
- ✅ Console.logs limpos

## 📋 Pré-requisitos na VPS

1. **Docker** e **Docker Compose** instalados
2. **Git** (opcional, para clonar o repo)
3. **Acesso SSH** à VPS

## 🔧 Passo a Passo

### 1. Preparar arquivos na VPS

```bash
# Criar diretório do projeto
mkdir -p /opt/g5x-agent-system
cd /opt/g5x-agent-system

# Copiar arquivos via SCP (do seu PC)
# scp -r g5x-agent-system/* root@SEU_IP:/opt/g5x-agent-system/
```

### 2. Configurar ambiente

```bash
# Copiar template de variáveis
cp .env.example .env

# Editar com suas credenciais
nano .env
```

**Variáveis obrigatórias:**
```env
DEEPSEEK_API_KEY=sua_chave_aqui
GROQ_API_KEY=sua_chave_aqui
PORT=3000
```

### 3. Build e Start

```bash
# Construir e subir containers
docker-compose up -d --build

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f g5x-server
```

### 4. Acessar o CRM

Abra no navegador: `http://SEU_IP:3000`

## 🔄 Comandos Úteis

```bash
# Parar containers
docker-compose down

# Reiniciar
docker-compose restart

# Atualizar código e rebuild
docker-compose up -d --build

# Ver logs em tempo real
docker-compose logs -f

# Acessar container
docker exec -it g5x-server sh
```

## 🗄️ Backup de Dados

Os dados estão em volumes Docker:
- `g5x-data` - Banco de dados JSON
- `g5x-uploads` - Arquivos enviados
- `redis-data` - Cache Redis

Para backup:
```bash
docker run --rm -v g5x-data:/data -v $(pwd):/backup alpine tar czf /backup/g5x-data-backup.tar.gz -C /data .
```

## 🐛 Troubleshooting

### Container não sobe
```bash
docker-compose logs g5x-server
```

### Porta já em uso
Edite `.env` e mude `PORT=3001`

### Redis não conecta
Verifique se a porta 6379 está livre:
```bash
netstat -tulpn | grep 6379
```

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do container: `docker-compose logs -f`
2. Health check: `curl http://localhost:3000/health`
3. Arquivo de dados: `docker exec g5x-server cat /app/data/crm-db.json`
