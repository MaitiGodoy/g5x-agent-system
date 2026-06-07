require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const apiRouter = require('./api');
const { leadQueue } = require('./queue');
const { engine } = require('./agent');
const app = express();
const port = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
// SEGURANÇA — Headers HTTP (Helmet)
// ═══════════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para permitir scripts inline do frontend
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir os arquivos estáticos do CRM (HTML, CSS, JS)
app.use(express.static('public'));

// ── Doutor Health Check (ANTES do apiRouter) ──
app.get('/api/health/llm', async (req, res) => {
  const llm = require('./tools/llm');
  try {
    const result = await llm.testConnection();
    res.json({
      provider: 'Doutor Antimatter Squad v4.7',
      status: result.doutor?.status || 'unknown',
      details: result.doutor || {},
      overall: result.doutor?.status === 'ok' ? 'healthy' : 'degraded'
    });
  } catch (e) {
    res.json({
      provider: 'Doutor Antimatter Squad v4.7',
      status: 'error',
      error: e.message,
      overall: 'degraded'
    });
  }
});

// Roteador da API do CRM (Leads, Kanban, Upload de PDF, RAG, Chat, Import)
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  let engineStatus = 'unknown';
  try { engineStatus = engine.getStatus(); } catch(e) { engineStatus = 'error: ' + e.message; }
  res.json({
    status: 'Servidor G5X rodando!',
    uptime: process.uptime(),
    engine: engineStatus,
  });
});

// Endpoint principal onde os Webhooks de CRM chegam
app.post('/webhook/incoming', async (req, res) => {
  try {
    const { leadId, message, source } = req.body;

    // Processar entrada no motor autônomo (pausa cadências, detecta intenção)
    const result = await engine.handleIncomingMessage(leadId, message, source);

    // Também tentar enfileirar no Redis se disponível
    try {
      const job = await leadQueue.add('incoming-message', { leadId, message, source });
      if (job) {
        console.log(`[Webhook] Mensagem de ${leadId} enfileirada.`);
        return res.status(202).json({ status: 'queued', leadId, engine: result });
      }
    } catch (e) { /* Redis offline — ok */ }

    res.status(202).json({ status: 'received', leadId, engine: result });
  } catch (error) {
    console.error('[Webhook] Erro:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.listen(port, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║  🚀 G5X MASTER OS - Servidor Ativo  ║`);
  console.log(`  ╠══════════════════════════════════════╣`);
  console.log(`  ║  CRM:  http://localhost:${port}/        ║`);
  console.log(`  ║  API:  http://localhost:${port}/api/    ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  // Validate Doutor AI status
  console.log('  [Doutor]  IA: Doutor Antimatter Squad v4.7\n');

  // Auto-start engine se configurado para iniciar automaticamente
  const config = require('./api').getAgentConfigDirect();
  if (config && config.running) {
    engine.start().catch(console.error);
  } else {
    console.log('[Engine] Aguardando ativação via config.agent.running=true\n');
  }
});
