require('dotenv').config();
const express = require('express');
const apiRouter = require('./api');
const { leadQueue } = require('./queue');
const { engine } = require('./agent');
const app = express();
const port = process.env.PORT || 3000;

// ── API Key Validation on Startup ──
function validateApiKeys() {
  const results = { groq: false, deepseek: false, warnings: [] };

  const groqKey = process.env.GROQ_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!groqKey || groqKey === 'test' || groqKey.length < 10) {
    results.warnings.push('⚠️ GROQ_API_KEY ausente ou inválida — fallback para DeepSeek');
  } else {
    results.groq = true;
  }

  if (!deepseekKey || deepseekKey === 'test' || deepseekKey.length < 10) {
    results.warnings.push('⚠️ DEEPSEEK_API_KEY ausente ou inválida — fallback para Groq');
  } else {
    results.deepseek = true;
  }

  if (!results.groq && !results.deepseek) {
    results.warnings.push('❌ NENHUMA API KEY válida! O chat NÃO funcionará.');
  }

  return results;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir os arquivos estáticos do CRM (HTML, CSS, JS)
app.use(express.static('public'));

// ── LLM Health Check (ANTES do apiRouter para não ser pego pela rota genérica /:table) ──
app.get('/api/health/llm', async (req, res) => {
  const results = validateApiKeys();
  const llm = require('./tools/llm');

  const testResults = { groq: null, deepseek: null };

  // Test Groq
  if (results.groq) {
    try {
      const start = Date.now();
      await llm.chat([{ role: 'user', content: 'Say "ok" in 2 words max' }]);
      testResults.groq = { status: 'ok', latency_ms: Date.now() - start };
    } catch (e) {
      testResults.groq = { status: 'error', message: e.message?.substring(0, 100) };
    }
  } else {
    testResults.groq = { status: 'not_configured' };
  }

  // Test DeepSeek
  if (results.deepseek) {
    try {
      const start = Date.now();
      await llm.chat([{ role: 'user', content: 'Say "ok" in 2 words max' }]);
      testResults.deepseek = { status: 'ok', latency_ms: Date.now() - start };
    } catch (e) {
      testResults.deepseek = { status: 'error', message: e.message?.substring(0, 100) };
    }
  } else {
    testResults.deepseek = { status: 'not_configured' };
  }

  res.json({
    keys: results,
    tests: testResults,
    overall: testResults.groq?.status === 'ok' || testResults.deepseek?.status === 'ok' ? 'healthy' : 'degraded'
  });
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

  // Validate API keys on startup
  const keyValidation = validateApiKeys();
  if (keyValidation.warnings.length > 0) {
    console.log('  [API Keys] Verificação:');
    keyValidation.warnings.forEach(w => console.log(`    ${w}`));
    console.log('');
  } else {
    console.log('  [API Keys] ✅ Groq + DeepSeek configuradas\n');
  }

  // Auto-start engine se configurado para iniciar automaticamente
  const config = require('./api').getAgentConfigDirect();
  if (config && config.running) {
    engine.start().catch(console.error);
  } else {
    console.log('[Engine] Aguardando ativação via config.agent.running=true\n');
  }
});
