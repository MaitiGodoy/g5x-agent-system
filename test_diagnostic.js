// G5X CRM — Diagnostic & Integration Test Suite
// Run: node test_diagnostic.js

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'crm-db.json');
const BASE = 'http://localhost:3000';

// ═══════════════════════════════════════
// PHASE 1: Static Analysis (no server needed)
// ═══════════════════════════════════════

console.log('\n╔══════════════════════════════════════════╗');
console.log('║  🔬 G5X CRM — DIAGNÓSTICO COMPLETO      ║');
console.log('╚══════════════════════════════════════════╝\n');

// 1. Check .env
console.log('═══ 1. ENVIRONMENT (.env) ═══');
try {
  require('dotenv').config();
  const checks = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? '✅ Set' : '❌ Missing',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing',
    GOOGLE_AI_KEY: process.env.GOOGLE_AI_KEY ? '✅ Set' : '❌ Missing',
    PORT: process.env.PORT || '3000 (default)',
    DATA_DIR: process.env.DATA_DIR || '__dirname (default)',
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads/ (default)',
  };
  for (const [k, v] of Object.entries(checks)) console.log(`  ${k}: ${v}`);
  
  // Critical: check if DATA_DIR/UPLOAD_DIR exist
  const dataDir = process.env.DATA_DIR;
  const uploadDir = process.env.UPLOAD_DIR;
  if (dataDir && !fs.existsSync(dataDir)) console.log(`  ⚠️  DATA_DIR="${dataDir}" NÃO EXISTE no filesystem!`);
  if (uploadDir && !fs.existsSync(uploadDir)) console.log(`  ⚠️  UPLOAD_DIR="${uploadDir}" NÃO EXISTE no filesystem!`);
} catch (e) {
  console.log('  ❌ Erro ao ler .env:', e.message);
}

// 2. Check database
console.log('\n═══ 2. DATABASE (crm-db.json) ═══');
try {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const tables = Object.keys(db);
  console.log(`  Total tables: ${tables.length}`);
  for (const t of tables) {
    const arr = db[t];
    const count = Array.isArray(arr) ? arr.length : (typeof arr === 'object' ? 'Object' : typeof arr);
    console.log(`  ${t}: ${count}`);
  }
  
  // Check agent_config
  const agentConfig = db.agent_config;
  if (Array.isArray(agentConfig) && agentConfig.length > 0) {
    const cfg = agentConfig[0];
    console.log(`\n  Agent Config:`);
    console.log(`    nome: ${cfg.nome}`);
    console.log(`    running: ${cfg.running}`);
    console.log(`    mcps: ${cfg.mcps ? JSON.stringify(Object.keys(cfg.mcps)) : 'UNDEFINED'}`);
  } else {
    console.log('  ⚠️  agent_config está vazio');
  }
  
  // Check knowledge_docs
  const docs = db.knowledge_docs || [];
  if (docs.length > 0) {
    console.log(`\n  Knowledge Docs (${docs.length}):`);
    docs.forEach(d => {
      console.log(`    - id:${d.id} | name:${d.name||'?'} | title:${d.title||'?'} | filename:${d.filename||'?'} | chunks:${d.chunks?.length||0} | chars:${d.char_count||'?'}`);
    });
  }
} catch (e) {
  console.log('  ❌ Erro ao ler DB:', e.message);
}

// 3. Check dependencies
console.log('\n═══ 3. DEPENDÊNCIAS (node_modules) ═══');
const deps = ['express', 'multer', 'pdf-parse', 'officeparser', 'mammoth', 'xlsx', 'openai', 'dotenv', 'bullmq', 'ioredis'];
for (const dep of deps) {
  try {
    const p = require.resolve(dep);
    console.log(`  ✅ ${dep}`);
  } catch {
    console.log(`  ❌ ${dep} — NOT INSTALLED`);
  }
}

// 4. Check file structure
console.log('\n═══ 4. ESTRUTURA DE ARQUIVOS ═══');
const requiredFiles = [
  'server.js', 'api.js', 'agent.js', 'queue.js', 'db.js',
  'tools/llm.js', 'tools/rag.js', 'tools/smart-import.js',
  'public/index.html', 'public/bridge.js',
  '.env', 'package.json'
];
for (const f of requiredFiles) {
  const fp = path.join(__dirname, f);
  const exists = fs.existsSync(fp);
  const size = exists ? fs.statSync(fp).size : 0;
  console.log(`  ${exists ? '✅' : '❌'} ${f} (${exists ? (size/1024).toFixed(1)+'KB' : 'MISSING'})`);
}

// 5. Check uploads directory
console.log('\n═══ 5. UPLOADS DIRECTORY ═══');
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  console.log(`  ✅ ./uploads/ exists (${files.length} files)`);
} else {
  console.log('  ⚠️  ./uploads/ does not exist — will be created on first upload');
}

// 6. API Route mapping — Check frontend vs backend alignment
console.log('\n═══ 6. FRONTEND↔BACKEND ROUTE ALIGNMENT ═══');

// Parse bridge.js endpoints
const bridgeJs = fs.readFileSync(path.join(__dirname, 'public', 'bridge.js'), 'utf8');
const bridgeEndpoints = [];
const fetchRegex = /(?:apiFetch|apiSend|apiDelete|apiUpload)\([`'"](.*?)[`'"]/g;
let match;
while ((match = fetchRegex.exec(bridgeJs)) !== null) {
  bridgeEndpoints.push(match[1].replace(/\$\{.*?\}/g, ':param'));
}

// Parse api.js endpoints
const apiJs = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
const apiEndpoints = [];
const routeRegex = /router\.(get|post|put|delete)\(['"`]\/?([^'"`]+)['"`]/g;
while ((match = routeRegex.exec(apiJs)) !== null) {
  apiEndpoints.push({ method: match[1].toUpperCase(), path: match[2] });
}

console.log(`  Bridge.js endpoints: ${bridgeEndpoints.length}`);
console.log(`  API.js endpoints: ${apiEndpoints.length}`);

// Check for critical missing endpoints
const criticalBridgeEndpoints = [
  'knowledge/upload', 'knowledge/docs', 'agent-config',
  'chat', 'dashboard', 'leads', 'ob-leads', 'indications',
  'partners', 'cadences', 'agent/status', 'agent/start', 'agent/stop'
];
for (const ep of criticalBridgeEndpoints) {
  const inBridge = bridgeEndpoints.some(b => b.includes(ep));
  const inApi = apiEndpoints.some(a => a.path.includes(ep.replace(/\//g, '/')));
  console.log(`  ${inBridge && inApi ? '✅' : (inBridge ? '⚠️ FE only' : (inApi ? '⚠️ BE only' : '❌'))} ${ep}`);
}

// 7. Detect duplicate route definitions  
console.log('\n═══ 7. DUPLICATE ROUTE CHECK ═══');
const routeMap = {};
const routeRegex2 = /router\.(get|post|put|delete)\(['"](.*?)['"]/g;
let m2;
while ((m2 = routeRegex2.exec(apiJs)) !== null) {
  const key = `${m2[1].toUpperCase()} ${m2[2]}`;
  if (!routeMap[key]) routeMap[key] = 0;
  routeMap[key]++;
}
const dupes = Object.entries(routeMap).filter(([k, v]) => v > 1);
if (dupes.length > 0) {
  console.log('  ⚠️  Rotas duplicadas encontradas:');
  dupes.forEach(([route, count]) => console.log(`    ${route} — ${count}x`));
} else {
  console.log('  ✅ Sem rotas duplicadas');
}

// 8. Check multer config alignment
console.log('\n═══ 8. MULTER/UPLOAD CONFIG ═══');
const uploadMatches = apiJs.match(/multer\(\s*\{[^}]+\}/g);
if (uploadMatches) {
  uploadMatches.forEach(m => console.log(`  Config: ${m}`));
}
// Check DATA_DIR fallback logic
const dataDirMatch = apiJs.match(/const DATA_DIR.*/);
const uploadDirMatch = apiJs.match(/const UPLOAD_DIR.*/);
if (dataDirMatch) console.log(`  ${dataDirMatch[0]}`);
if (uploadDirMatch) console.log(`  ${uploadDirMatch[0]}`);

console.log('\n╔══════════════════════════════════════════╗');
console.log('║  DIAGNÓSTICO ESTÁTICO COMPLETO           ║');
console.log('╚══════════════════════════════════════════╝\n');

// ═══════════════════════════════════════
// PHASE 2: Live API Tests (needs server running)  
// ═══════════════════════════════════════

async function runLiveTests() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🌐 TESTES DE API (LIVE)                 ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const results = {};

  async function test(name, url, opts = {}) {
    try {
      const resp = await fetch(`${BASE}${url}`, opts);
      const status = resp.status;
      let body;
      try { body = await resp.json(); } catch { body = await resp.text(); }
      const ok = status >= 200 && status < 400;
      console.log(`  ${ok ? '✅' : '❌'} [${status}] ${opts.method || 'GET'} ${url}`);
      if (!ok) console.log(`    → ${JSON.stringify(body).substring(0, 200)}`);
      results[name] = { ok, status, body };
      return body;
    } catch (e) {
      console.log(`  ❌ ${opts.method || 'GET'} ${url} — ${e.message}`);
      results[name] = { ok: false, error: e.message };
      return null;
    }
  }

  // Health
  console.log('── Health ──');
  await test('health', '/health');
  await test('dashboard', '/api/dashboard');

  // Leads
  console.log('\n── Leads ──');
  await test('leads_list', '/api/leads');
  const newLead = await test('leads_create', '/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Lead DIAG', company: 'DiagCo', email: 'test@diag.com', source: 'intec', status: 'entrada_triagem' })
  });

  if (newLead?.id) {
    await test('leads_update', `/api/leads/${newLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'DiagCo Updated' })
    });
    await test('leads_stage', `/api/leads/${newLead.id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'diagnostico_agendado' })
    });
    await test('leads_delete', `/api/leads/${newLead.id}`, { method: 'DELETE' });
  }

  // Outbound
  console.log('\n── Outbound ──');
  await test('ob_list', '/api/ob-leads');
  await test('cadences', '/api/cadences');

  // Indicações
  console.log('\n── Indicações ──');
  await test('indications_list', '/api/indications');
  const newInd = await test('indication_create', '/api/indications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referrer_name: 'Diag Referrer', referred_name: 'Diag Referred', referred_company: 'DiagRefCo' })
  });
  if (newInd?.id) {
    await test('indication_delete', `/api/indications/${newInd.id}`, { method: 'DELETE' });
  }

  // Partners
  console.log('\n── Parceiros ──');
  await test('partners_list', '/api/partners');

  // Agent Config
  console.log('\n── Agent Config ──');
  const agentConfig = await test('agent_config', '/api/agent-config');
  if (agentConfig) {
    console.log(`    nome: ${agentConfig.nome}`);
    console.log(`    running: ${agentConfig.running}`);
    console.log(`    mcps: ${agentConfig.mcps ? JSON.stringify(Object.keys(agentConfig.mcps)) : 'UNDEFINED'}`);
  }
  await test('agent_status', '/api/agent/status');

  // Knowledge
  console.log('\n── Knowledge (GET) ──');
  await test('knowledge_docs', '/api/knowledge/docs');
  await test('knowledge_faq', '/api/knowledge/faq');
  await test('knowledge_urls', '/api/knowledge/urls');
  await test('knowledge_texts', '/api/knowledge/texts');
  await test('knowledge_objections', '/api/knowledge/objections');

  // Knowledge Upload Test (TXT)
  console.log('\n── Knowledge Upload (TXT) ──');
  try {
    const boundary = '----FormBoundary' + Date.now();
    const testContent = 'Este é um documento de teste para validar o upload de conhecimento. Crédito, faturamento, CNPJ, balanço patrimonial, análise de crédito, taxa de juros, capital de giro.';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test_diag.txt"',
      'Content-Type: text/plain',
      '',
      testContent,
      `--${boundary}--`
    ].join('\r\n');

    const uploadResp = await fetch(`${BASE}/api/knowledge/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: payload,
    });
    const uploadResult = await uploadResp.json();
    console.log(`  ${uploadResp.ok ? '✅' : '❌'} [${uploadResp.status}] POST /api/knowledge/upload`);
    console.log(`    → ${JSON.stringify(uploadResult).substring(0, 300)}`);
    results['knowledge_upload_txt'] = { ok: uploadResp.ok, body: uploadResult };
  } catch (e) {
    console.log(`  ❌ Knowledge upload failed: ${e.message}`);
    results['knowledge_upload_txt'] = { ok: false, error: e.message };
  }

  // Chat
  console.log('\n── Chat ──');
  await test('chat_history', '/api/chat');
  // Don't test chat send — it calls LLM and takes time

  // BI/Dashboard
  console.log('\n── BI/Dashboard ──');
  await test('bi_dashboard', '/api/dashboard');
  await test('activity_log', '/api/activity-log');

  // Booking
  console.log('\n── Booking ──');
  await test('booking_config', '/api/booking/config');
  await test('bookings_list', '/api/bookings');

  // Summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  📊 RESUMO DOS TESTES                    ║');
  console.log('╚══════════════════════════════════════════╝\n');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r.ok).length;
  const failed = total - passed;
  console.log(`  Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n  Falhas:');
    for (const [name, r] of Object.entries(results)) {
      if (!r.ok) console.log(`    ❌ ${name}: ${r.error || JSON.stringify(r.body).substring(0, 100)}`);
    }
  }

  return results;
}

// Check if server is running first
fetch(`${BASE}/health`).then(() => {
  runLiveTests().catch(console.error);
}).catch(() => {
  console.log('⚠️  Server não está rodando em localhost:3000');
  console.log('   Execute: node server.js');
  console.log('   Depois rode novamente: node test_diagnostic.js');
});
