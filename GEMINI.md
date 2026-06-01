# G5X Agent System — Instruções para o Agente de IA

## Sobre o Projeto
O **G5X Agent System** é um CRM SDR Autônomo para operações de crédito imobiliário (GERIC FAST / Caixa Econômica Federal). Ele gerencia leads construtoras desde a triagem até a liberação de crédito.

## Stack Técnica
- **Backend:** Node.js (Express) — `server.js`
- **Agente IA:** `agent.js` — roda heartbeat de 120s, analisa leads autonomamente
- **Frontend:** React browser-build via Babel — `public/index.html`
- **Banco:** Supabase (PostgreSQL)
- **Queue:** BullMQ + Redis (opcional, funciona sem)
- **LLM Router:** Groq → DeepSeek (compatível com API OpenAI)
- **Deploy:** Docker + VPS Linux

## Estrutura de Arquivos
```
g5x-agent-system/
├── server.js          # API Express principal (CRUD leads, auth, websockets)
├── agent.js           # Agente autônomo — ciclo heartbeat 120s
├── api.js             # Rotas e lógica de negócio avançada
├── queue.js           # BullMQ job queue
├── build.js           # Build do frontend React
├── tools/             # Ferramentas do agente (llm.js, email, whatsapp)
├── mcps/              # Model Context Protocol servers
├── public/            # Frontend React (bridge.js + index.html)
├── email-templates/   # Templates de e-mail da cadência
├── uploads/           # Arquivos enviados pelos usuários
├── Dockerfile         # Container para VPS
├── docker-compose.yml # Orquestração Docker
└── .env               # Variáveis de ambiente (NUNCA commitar)
```

## Como Rodar

### Desenvolvimento (local) — sobe SERVER + AGENT juntos
```bash
npm run dev
```

### Só o servidor
```bash
npm run dev:server
```

### Só o agente
```bash
npm run dev:agent
```

### Produção (VPS)
```bash
# Via Docker Compose
docker-compose up -d --build
```

## Variáveis de Ambiente Necessárias (.env)
```
DEEPSEEK_API_KEY=     # LLM principal
GROQ_API_KEY=         # LLM fallback
SUPABASE_URL=         # Banco de dados
SUPABASE_KEY=         # Chave do Supabase
SMTP_EMAIL=           # E-mail para cadência
SMTP_PASSWORD=        # Senha do SMTP
PORT=3000
AGENT_AUTO_START=true
AGENT_HEARTBEAT_SECONDS=120
```

## Pipeline de Negócio (Kanban)
1. **Entrada & Triagem** — Classificação automática por origem (Intec/Indicação)
2. **Diagnóstico Agendado** — Call de 15 min registrada
3. **Viabilidade Técnica** — Balanço e Rating processados
4. **Apresentação de Teto** — Oferta até 5x faturamento
5. **Diligência Matriz** — Pasta técnica montada
6. **Crédito na Tela** — Fechamento + Honorários no Êxito

## Regras de Origem
- **Intec (Frio):** Cadência 10 Toques (5 E-mails + 5 WhatsApps)
- **Indicação (Quente):** Bloquear automações, contato direto imediato

## Deploy VPS
- Política: PC → VPS **manual** (não automático)
- VPS estável: v25-estavel (2026-05-16)
- Arquivo `.sync-control` controla sincronização
- Comando: atualizar VPS (via SFTP/rsync + Docker rebuild)

## Regras do Agente
- Nunca alterar `.env` com credenciais reais
- Nunca commitar `node_modules/`, `.env`, `uploads/`
- Testar localmente ANTES de sugerir deploy para VPS
- O arquivo `crm-db.json` é backup local do banco — não usar como banco principal
- Redis é opcional — BullMQ funciona sem, mas com limitações de persistência

## MCPs Planejados (pós-VPS estável)
- WhatsApp (evolutionapi ou similar)
- Instagram Direct
- LinkedIn
- E-mail (já parcialmente implementado via SMTP)

## Vulnerabilidades Conhecidas (npm audit)
- 2 moderadas, 1 alta — em dependências transitivas
- Rodar `npm audit fix` quando não houver risco de breaking changes
