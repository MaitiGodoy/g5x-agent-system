# ═══════════════════════════════════════════════════════════════
# G5X MASTER OS — Dockerfile Production (Python + Node + Doutor)
# ═══════════════════════════════════════════════════════════════
FROM python:3.11-slim

LABEL maintainer="G5X Team"
LABEL description="G5X Agent System - CRM SDR Autônomo com Doutor Antimatter Squad v4.7"

# ── Instalar Node.js 20.x ──
RUN apt-get update && apt-get install -y curl gnupg wget ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Variáveis de ambiente ──
ENV NODE_ENV=production
ENV PORT=3000
ENV DOUTOR_ENABLED=true
ENV DOUTOR_PYTHON=python

# ── Diretório de trabalho ──
WORKDIR /app

# ── Copiar e instalar dependências Node ──
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ── Dependências Python para o Bridge (fallback HTTP) ──
RUN pip install --no-cache-dir aiohttp

# ── Copiar código do CRM ──
COPY server.js api.js agent.js queue.js build.js ./
COPY tools/ ./tools/
COPY mcps/ ./mcps/
COPY public/ ./public/

# ── Criar diretórios necessários ──
RUN mkdir -p /app/uploads /app/data && \
    chown -R root:root /app

# ── Healthcheck ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# ── Porta ──
EXPOSE 3000

# ── Start ──
CMD ["node", "server.js"]
