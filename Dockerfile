# ═══════════════════════════════════════════
# G5X MASTER OS — Dockerfile Production
# ═══════════════════════════════════════════
FROM node:20-alpine

# Metadata
LABEL maintainer="G5X Team"
LABEL description="G5X Agent System - CRM SDR Autônomo com IA"

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Diretório de trabalho
WORKDIR /app

# Copiar deps e instalar (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código
COPY server.js api.js agent.js queue.js build.js ./
COPY tools/ ./tools/
COPY mcps/ ./mcps/
COPY public/ ./public/

# Criar diretórios necessários com permissão
RUN mkdir -p /app/uploads /app/data && \
    chown -R node:node /app

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Porta
EXPOSE 3000

# Rodar como usuário não-root
USER node

# Start
CMD ["node", "server.js"]
