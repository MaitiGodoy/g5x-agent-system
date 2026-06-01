const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const llm = require('./tools/llm');
const rag = require('./tools/rag');
const smartImport = require('./tools/smart-import');
const fs = require('fs');
const path = require('path');
const https = require('https');

const router = express.Router();

// Diretórios configuráveis (Docker volumes ou local)
const DATA_DIR = (process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)) ? process.env.DATA_DIR : __dirname;
const UPLOAD_DIR = (process.env.UPLOAD_DIR && fs.existsSync(process.env.UPLOAD_DIR)) ? process.env.UPLOAD_DIR : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

// ── Banco JSON local ──
const dbFile = path.join(DATA_DIR, 'crm-db.json');
let db = {};
if (fs.existsSync(dbFile)) {
  db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function saveDb() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function getTable(table) {
  if (!db[table]) { db[table] = []; saveDb(); }
  return db[table];
}

// ── Lead Score engine ──
function calcLeadScore(lead) {
  let score = 0;
  // Cargo (seniority)
  const title = (lead.job_title || '').toLowerCase();
  if (/ceo|founder|presidente|dono|proprietário|socio|sócio/.test(title)) score += 30;
  else if (/diretor|director|vp|vice/.test(title)) score += 22;
  else if (/gerente|manager|head|coord/.test(title)) score += 15;
  else if (/analista|analyst|especialista/.test(title)) score += 8;
  else if (title) score += 5;
  // Dados de contato
  if (lead.email) score += 10;
  if (lead.phone) score += 10;
  if (lead.linkedin_url) score += 8;
  // Valor do deal
  const val = Number(lead.value || 0);
  if (val >= 100000) score += 20;
  else if (val >= 50000) score += 15;
  else if (val >= 10000) score += 10;
  else if (val > 0) score += 5;
  // Empresa
  if (lead.company) score += 5;
  if (lead.main_pain) score += 7;
  // Penalidades
  const days = Math.floor((Date.now() - new Date(lead.last_stage_change || lead.created_at || Date.now()).getTime()) / 86400000);
  if (days > 30) score -= 20;
  else if (days > 14) score -= 10;
  else if (days > 7) score -= 5;
  return Math.max(0, Math.min(100, score));
}

// ── Notification helper ──
function logActivity(type, leadId, text, channel = 'sistema') {
  const log = getTable('activity_log');
  log.push({ id: Date.now().toString(), type, lead_id: leadId, text, channel, created_at: new Date().toISOString() });
  if (log.length > 1000) db['activity_log'] = log.slice(-1000);
  saveDb();
}

// ── Enriquecimento CNPJ (ReceitaWS) ──
router.get('/enrich/cnpj/:cnpj', (req, res) => {
  const cnpj = req.params.cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' });
  
  https.get(`https://receitaws.com.br/v1/cnpj/${cnpj}`, (resp) => {
    let data = '';
    resp.on('data', (chunk) => data += chunk);
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.status === 'ERROR') return res.status(400).json({ error: parsed.message });
        res.json({
          company: parsed.nome,
          fantasia: parsed.fantasia,
          phone: parsed.telefone,
          email: parsed.email,
          natureza: parsed.natureza_juridica,
          porte: parsed.porte,
          capital: parsed.capital_social,
          atividade: parsed.atividade_principal?.[0]?.text
        });
      } catch (e) { res.status(500).json({ error: 'Erro ao analisar resposta' }); }
    });
  }).on('error', (err) => res.status(500).json({ error: err.message }));
});

// ============================================================
// ROTAS ESPECIAIS
// ============================================================

// ── 1. Upload Universal de Conhecimento (PDF, PPTX, XLSX, CSV, DOCX, TXT, MD) ──
router.post('/knowledge/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;
    let fullText = '';
    let contentType = 'unknown';

    try {
      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const data = await parser.getText();
        fullText = data.text || '';
        contentType = 'pdf';
      }
      else if (['.xlsx', '.xls'].includes(ext)) {
        const xlsx = require('xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheets = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const json = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          sheets.push(`=== Planilha: ${sheetName} ===\n${json.map(row => row.join(' | ')).join('\n')}`);
        }
        fullText = sheets.join('\n\n');
        contentType = 'spreadsheet';
      }
      else if (ext === '.csv') {
        const raw = fs.readFileSync(filePath, 'utf8');
        fullText = raw;
        contentType = 'csv';
      }
      else if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        fullText = result.value || '';
        contentType = 'docx';
      }
      else if (ext === '.pptx') {
        const officeParser = require('officeparser');
        const ast = await officeParser.parseOffice(filePath);
        if (typeof ast === 'string') { fullText = ast; }
        else if (ast && ast.content) {
          const walk = (n) => { if (!n) return ''; if (typeof n === 'string') return n; if (Array.isArray(n)) return n.map(walk).join('\n'); return n.text || walk(n.content) || walk(n.children) || ''; };
          fullText = walk(ast.content) || JSON.stringify(ast);
        } else { fullText = String(ast); }
        contentType = 'pptx';
      }
      else if (['.txt', '.md', '.log'].includes(ext)) {
        fullText = fs.readFileSync(filePath, 'utf8');
        contentType = ext === '.md' ? 'markdown' : 'text';
      }
      else {
        fullText = fs.readFileSync(filePath, 'utf8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
        contentType = 'raw_text';
      }
    } catch (parseErr) {
      console.warn(`[RAG] Falha ao parsear ${ext}: ${parseErr.message}. Tentando fallback.`);
      try {
        fullText = fs.readFileSync(filePath, 'utf8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
        contentType = 'fallback';
      } catch {
        return res.status(422).json({ error: `Não foi possível extrair texto do arquivo ${ext}` });
      }
    }

    fullText = fullText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    if (!fullText || fullText.length < 10) {
      return res.status(422).json({ error: 'Arquivo não contém texto extraível legível.' });
    }

    const ingested = rag.ingestDocument(fullText, {
      id: Date.now().toString(),
      filename: req.file.originalname
    });

    const docs = getTable('knowledge_docs');
    const newDoc = {
      ...ingested,
      name: req.file.originalname,
      title: req.file.originalname.replace(/\.[^/.]+$/, ''),
      content_type: contentType,
      file_type: ext,
      raw_text: fullText.substring(0, 100000),
      summary: fullText.substring(0, 500).replace(/\n/g, ' '),
      word_count: fullText.split(/\s+/).length,
      char_count: fullText.length
    };
    docs.push(newDoc);
    saveDb();

    try { fs.unlinkSync(filePath); } catch {}

    console.log(`[RAG] "${req.file.originalname}" → ${contentType} | ${fullText.length} chars | ${ingested.chunks.length} chunks`);
    res.json({ success: true, doc: { id: newDoc.id, title: newDoc.title, content_type: newDoc.content_type, char_count: newDoc.char_count } });
  } catch (error) {
    console.error('[RAG] Erro:', error);
    res.status(500).json({ error: 'Falha ao processar o arquivo' });
  }
});

// ── 2. Import Inteligente de Lista Fria (CSV/TXT/JSON/Excel/Texto Colado/Qualquer Formato) ──
router.post('/leads/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result;
    
    if (['.xlsx', '.xls'].includes(ext)) {
      // Excel: passa o buffer direto
      const fileBuffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
      result = await smartImport.processList(null, {
        useAI: req.body.useAI !== 'false',
        skipDuplicates: req.body.skipDuplicates !== 'false',
        enrichCNPJ: req.body.enrichCNPJ === 'true',
        fileBuffer: fileBuffer
      });
    } else {
      // CSV/TXT/JSON: lê como texto
      const raw = fs.readFileSync(req.file.path, 'utf8');
      fs.unlinkSync(req.file.path);
      result = await smartImport.processList(raw, {
        useAI: req.body.useAI !== 'false',
        skipDuplicates: req.body.skipDuplicates !== 'false',
        enrichCNPJ: req.body.enrichCNPJ === 'true'
      });
    }
    
    if (result.leads.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead válido encontrado', details: result.errors });
    }
    
    const leads = getTable('leads');
    const added = [];
    
    for (const lead of result.leads) {
      leads.push(lead);
      added.push(lead);
      
      if (req.body.target === 'outbound') {
        const obLeads = getTable('ob_leads');
        obLeads.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          crm_lead_id: lead.id, name: lead.name, company: lead.company,
          phone: lead.phone, email: lead.email, linkedin_url: lead.linkedin_url,
          job_title: lead.job_title, status: 'fila',
          last_contact: new Date().toISOString().split('T')[0],
          cadencia_step: 1, cadencia_id: req.body.cadencia_id || '',
          channel: 'whatsapp', paused: false, created_at: new Date().toISOString()
        });
      }
    }
    
    saveDb();
    console.log(`[SmartImport] ${added.length} leads importados de "${req.file.originalname}"`);
    res.json({ success: true, count: added.length, leads: added, stats: result.stats, errors: result.errors });
  } catch (error) {
    console.error('[SmartImport] Erro:', error);
    res.status(500).json({ error: 'Falha ao importar. Verifique o formato.' });
  }
});

// ── 2b. Import via texto colado (sem arquivo) ──
router.post('/leads/import-text', async (req, res) => {
  try {
    const { text, target, cadencia_id, useAI, skipDuplicates, enrichCNPJ } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Nenhum texto fornecido' });
    
    const result = await smartImport.processList(text.trim(), {
      useAI: useAI !== 'false',
      skipDuplicates: skipDuplicates !== 'false',
      enrichCNPJ: enrichCNPJ === 'true'
    });
    
    if (result.leads.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead válido encontrado', details: result.errors });
    }
    
    const leads = getTable('leads');
    const added = [];
    
    for (const lead of result.leads) {
      leads.push(lead);
      added.push(lead);
      
      if (target === 'outbound') {
        const obLeads = getTable('ob_leads');
        obLeads.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          crm_lead_id: lead.id, name: lead.name, company: lead.company,
          phone: lead.phone, email: lead.email, linkedin_url: lead.linkedin_url,
          job_title: lead.job_title, status: 'fila',
          last_contact: new Date().toISOString().split('T')[0],
          cadencia_step: 1, cadencia_id: cadencia_id || '',
          channel: 'whatsapp', paused: false, created_at: new Date().toISOString()
        });
      }
    }
    
    saveDb();
    console.log(`[SmartImport-Text] ${added.length} leads importados via texto`);
    res.json({ success: true, count: added.length, leads: added, stats: result.stats, errors: result.errors });
  } catch (error) {
    console.error('[SmartImport-Text] Erro:', error);
    res.status(500).json({ error: 'Falha ao processar texto.' });
  }
});

// ── 2c. Preview de import (mostra como ficaria sem salvar) ──
router.post('/leads/import-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result;
    
    if (['.xlsx', '.xls'].includes(ext)) {
      const fileBuffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
      result = await smartImport.processList(null, {
        useAI: req.body.useAI !== 'false',
        skipDuplicates: req.body.skipDuplicates !== 'false',
        enrichCNPJ: false,
        fileBuffer: fileBuffer
      });
    } else {
      const raw = fs.readFileSync(req.file.path, 'utf8');
      fs.unlinkSync(req.file.path);
      result = await smartImport.processList(raw, {
        useAI: req.body.useAI !== 'false',
        skipDuplicates: req.body.skipDuplicates !== 'false',
        enrichCNPJ: false
      });
    }
    
    res.json({
      success: true,
      preview: result.leads.slice(0, 10),
      total: result.leads.length,
      stats: result.stats,
      column_mapping: result.column_mapping,
      errors: result.errors
    });
  } catch (error) {
    console.error('[ImportPreview] Erro:', error);
    res.status(500).json({ error: 'Falha ao pré-visualizar.' });
  }
});

// ── 2d. Normalizar dados de lead específico ──
router.post('/leads/:id/normalize', (req, res) => {
  const leads = getTable('leads');
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  
  const before = { ...lead };
  
  if (lead.name) lead.name = smartImport.normalizeName(lead.name);
  if (lead.phone) lead.phone = smartImport.normalizePhone(lead.phone);
  if (lead.email) lead.email = smartImport.normalizeEmail(lead.email);
  if (lead.company) lead.company = smartImport.normalizeCompany(lead.company);
  if (lead.cnpj) lead.cnpj = smartImport.normalizeCNPJ(lead.cnpj);
  
  lead.normalized_at = new Date().toISOString();
  saveDb();
  
  res.json({ success: true, before, after: lead });
});

function parseCSV(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  let sep = ',';
  if (firstLine.includes(';')) sep = ';';
  else if (firstLine.includes('\t')) sep = '\t';
  else if (firstLine.includes('|')) sep = '|';
  const headers = firstLine.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    results.push(obj);
  }
  return results;
}

// ── 6. Indicações (Leads Mornos/Quentes via Indicação) ──
router.get('/indications', (req, res) => {
  res.json(getTable('indications'));
});

router.post('/indications', (req, res) => {
  const { referrer_name, referrer_contact, referred_name, referred_email, referred_phone, referred_job, referred_company, message, status } = req.body;
  const indication = {
    id: Date.now().toString(),
    referrer_name: referrer_name || '',
    referrer_contact: referrer_contact || '',
    referred_name: referred_name || '',
    referred_email: referred_email || '',
    referred_phone: referred_phone || '',
    referred_job: referred_job || '',
    referred_company: referred_company || '',
    message: message || '',
    status: status || 'warm',
    created_at: new Date().toISOString()
  };
  getTable('indications').push(indication);
  saveDb();
  logActivity('indication', null, 'Nova indicação: ' + referred_name + ' (referidor: ' + referrer_name + ')');
  res.json(indication);
});

router.put('/indications/:id', (req, res) => {
  const items = getTable('indications');
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx > -1) { items[idx] = { ...items[idx], ...req.body }; saveDb(); res.json(items[idx]); }
  else res.status(404).json({ error: 'Not found' });
});

router.delete('/indications/:id', (req, res) => {
  db['indications'] = getTable('indications').filter(i => i.id !== req.params.id);
  saveDb(); res.json({ success: true });
});

router.post('/indications/:id/convert', (req, res) => {
  const indications = getTable('indications');
  const indication = indications.find(i => i.id === req.params.id);
  if (!indication) return res.status(404).json({ error: 'Indicação não encontrada' });
  const newLead = {
    id: Date.now().toString(),
    name: indication.referred_name || 'Sem nome',
    company: indication.referred_company || '',
    phone: indication.referred_phone || '',
    email: indication.referred_email || '',
    job_title: indication.referred_job || '',
    main_pain: indication.message || '',
    source: 'indicacao',
    status: 'novo',
    partner_id: '',
    value: 0,
    linkedin_url: '',
    last_stage_change: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  getTable('leads').push(newLead);
  indication.status = 'converted';
  indication.converted_at = new Date().toISOString();
  indication.converted_lead_id = newLead.id;
  saveDb();
  logActivity('indication', newLead.id, 'Indicação convertida em lead: ' + newLead.name);
  res.json({ success: true, lead: newLead });
});

router.put('/indications/:id/status', (req, res) => {
  const indications = getTable('indications');
  const indication = indications.find(i => i.id === req.params.id);
  if (indication) { indication.status = req.body.status; saveDb(); res.json(indication); }
  else res.status(404).json({ error: 'Indicação não encontrada' });
});

// ── 3. Agente SOBERANO — Acesso Total ao CRM ──
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log(`[Agente] "${message}"`);

    const leads      = getTable('leads');
    const obLeads    = getTable('ob_leads');
    const cadences   = getTable('cadences');
    const partners   = getTable('partners');
    const knowledge  = getTable('knowledge_docs');
    const faq        = getTable('knowledge_faq');
    const objections = getTable('knowledge_objections');
    const texts      = getTable('knowledge_texts');
    const config     = getTable('agent_config');
    const agentName    = (Array.isArray(config) && config[0]?.nome) || 'G5X Agent';
    const agentPersona = (Array.isArray(config) && config[0]?.persona) || 'SDR consultivo especialista em vendas B2B outbound';

    const wonLeads = leads.filter(l => l.status === 'sucesso');
    const revenue  = wonLeads.reduce((a,b) => a + Number(b.value||0), 0);

    const crmSnapshot = {
      leads_total: leads.length,
      leads_pipeline: leads.filter(l => !['sucesso','recusado'].includes(l.status)).length,
      leads_ganhos: wonLeads.length,
      receita: `R$ ${revenue.toLocaleString('pt-BR')}`,
      taxa_conversao: leads.length > 0 ? `${Math.round((wonLeads.length/leads.length)*100)}%` : '0%',
      outbound_ativo: obLeads.filter(l => !l.paused && l.status !== 'descartado').length,
      outbound_fila: obLeads.filter(l => l.status === 'fila').length,
      cadencias: cadences.map(c => ({ id: c.id, nome: c.name, status: c.status, passos: c.cadence_steps?.length||0 })),
      parceiros: partners.map(p => ({ id: p.id, nome: p.name })),
      por_estagio: leads.reduce((acc,l) => { acc[l.status]=(acc[l.status]||0)+1; return acc; }, {}),
      leads_recentes: leads.slice(-8).map(l => ({ id: l.id, nome: l.name, empresa: l.company, status: l.status, valor: l.value, email: l.email, phone: l.phone })),
      ob_fila_preview: obLeads.filter(l=>l.status==='fila').slice(0,5).map(l => ({ id: l.id, nome: l.name, empresa: l.company, step: l.cadencia_step })),
      indicacoes: getTable('indications').filter(i => i.status !== 'converted').length,
      indicacoes_hot: getTable('indications').filter(i => i.status === 'hot').length,
      agendados: leads.filter(l => l.calendly_link).length,
      calendly_configured: !!process.env.CALENDLY_TOKEN,
    };

    const knowledgeCtx = [
      ...knowledge.map(d => d.text?.substring(0, 15000)).filter(Boolean),
      ...faq.map(f => `FAQ — P: ${f.question} R: ${f.answer}`),
      ...objections.map(o => `OBJEÇÃO: ${o.objection} → ${o.response}`),
      ...texts.map(t => `[${t.category}] ${t.title}: ${t.content}`),
    ].join('\n').substring(0, 35000);

    // RAG: Buscar contexto relevante baseado na mensagem do usuário
    let ragContext = '';
    try {
      const ragResults = await rag.findRelevantContextString(message, 3);
      if (ragResults) {
        ragContext = `\n\nCONTEXTO RECUPERADO DA BASE DE CONHECIMENTO (RAG):\n${ragResults.substring(0, 8000)}`;
        console.log(`[RAG] Contexto injetado no prompt (${ragResults.length} chars)`);
      }
    } catch (e) {
      console.warn('[RAG] Falha ao buscar contexto:', e.message);
    }

    const systemPrompt = `Você é ${agentName} — Arquiteto(a) de Pipeline Unificado e Roteamento G5X.
Você é o Motor de Raciocínio de CRM da G5X. Você gerencia um Pipeline Único de alavancagem, garantindo que leads frios (Intec) e quentes (Indicações) cheguem ao mesmo objetivo final — crédito liberado na tela — através de caminhos de abordagem distintos.

═══════════════════════════════════════════════════
ESTRUTURA DO PIPELINE ÚNICO (G5X):
1. Entrada & Triagem — Classificação automática por origem
2. Diagnóstico Agendado — Call de 15 min registrada
3. Viabilidade Técnica — Balanço e Rating processados
4. Apresentação de Teto — Oferta de até 5x faturamento
5. Diligência Matriz — Pasta técnica montada  
6. Crédito na Tela — Fechamento e Honorários no Êxito
═══════════════════════════════════════════════════

REGRAS DE ORIGEM:
| Origem | Ação |
|--------|------|
| Intec (Frio) | Cadência de 10 Toques (5 E-mails + 5 WhatsApps) |
| Indicação (Quente) | Bloquear automações. Abordagem Direta com Autoridade Emprestada |

═══════════════════════════════════════════════════
SNAPSHOT REAL DO CRM (atualizado agora):
${JSON.stringify(crmSnapshot, null, 2)}
═══════════════════════════════════════════════════

BASE DE CONHECIMENTO DO PRODUTO:
${knowledgeCtx || 'Nenhum documento carregado. Sugira ao operador fazer upload de PDFs na aba Conhecimento.'}${ragContext}

═══════════════════════════════════════════════════
SUAS AÇÕES DISPONÍVEIS:
Quando precisar executar algo no CRM, inclua no final da sua resposta:

\`\`\`action
{ "action": "NOME_ACAO", "data": { ...campos } }
\`\`\`

AÇÕES DISPONÍVEIS:
| Ação | Campos obrigatórios |
|------|-------------------|
| create_lead | name, company, source ("intec"/"indicacao"), status ("entrada_triagem") |
| update_lead | id, + qualquer campo |
| move_lead | id, status ("entrada_triagem"/"diagnostico_agendado"/"viabilidade_tecnica"/"apresentacao_teto"/"diligencia_matriz"/"credito_na_tela"/"perdido_arquivado") |
| delete_lead | id |
| create_cadence | name, status ("Ativa"/"Rascunho"), cadence_steps: [{day, channel ("whatsapp"/"email"/"linkedin"), message_template}] |
| add_to_outbound | crm_lead_id, cadencia_id |
| create_partner | name, contact_name, email, phone |
| add_faq | question, answer |
| add_objection | objection, response |
| create_indication | referrer_name, referred_name, referred_company, referred_phone, message |
| convert_indication | id |
| schedule_call | lead_id, lead_email (Gera link Calendly para Diagnóstico) |
| send_email | lead_id, subject, message, [template] |

═══════════════════════════════════════════════════
DIRETRIZES DE NEGOCIAÇÃO (Voss/Dixon/Rackham) — SIGA RIGOROSAMENTE:
1. SEM JARGÕES: Proibido "Funding" ou "Recurso Disponível". Use "Limite de Crédito" e "Crédito na Tela".
2. PERGUNTAS CALIBRADAS: Use "Como" e "O quê". Ex: "Como você planeja rodar as obras previstas se o banco de varejo continuar limitando seu teto?"
3. AUTORIDADE EMPRESTADA: Em indicações, a palavra do indicador vale mais que qualquer slide. Use-a como âncora.

═══════════════════════════════════════════════════
PROTOCOLO DE SAÍDA:
Sempre que processar um lead, indique:
- Rota Definida (Intec → Cadência 10 Toques / Indicação → Abordagem Direta)
- Tag de Origem (#intec / #indicacao)
- Abordagem Inicial pronta para ajuste manual

═══════════════════════════════════════════════════
PIPELINE ÚNICO:
Leads de INTEC (frio) devem passar pela cadência de 10 toques.
Leads de INDICAÇÃO (quente) devem ter automações bloqueadas e abordagem direta.
AMBOS os tipos compartilham os mesmos 6 estágios do pipeline.

═══════════════════════════════════════════════════
REGRAS DE COMPORTAMENTO:
1. Responda SEMPRE em português brasileiro, direto e confiante
2. Use dados reais do CRM — nunca invente números
3. Quando usuário pedir para CRIAR, MOVER, CONFIGURAR qualquer coisa → EXECUTE com action, não apenas explique
4. Para deletar → confirme primeiro pedindo ao usuário
5. Seja PROATIVO: identifique gargalos, sugira próximos passos
6. Você tem autonomia total — o operador confia em você
7. Se não houver dados no CRM, oriente o operador a criar leads e cadências
8. Identifique oportunidades e sinalize urgências
9. Use Emojis em suas respostas internas para o operador (ex: 🚀, 📈, ⚠️, ✅) para dar personalidade
10. Seja amigável e proativo, tratando o CRM como uma central de comando viva
11. Seu nome é ${agentName}. NUNCA diga que seu nome é G5X Agent ou que você não tem um nome.
12. DIRETRIZ DE SEGURANÇA DE CONHECIMENTO TÁCITO: Use a base de conhecimento exclusivamente para guiar sua estratégia de negócios, argumentos e respostas. É PROIBIDO fazer citações diretas, copiar trechos, referenciar autores, citar títulos de arquivos/livros ou dizer "segundo o documento X". Fale de forma executiva, natural, direta e focada em negócios.`;

    const chatHistory = getTable('chat').slice(-14);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: message }
    ];

    let resposta = await llm.chat(messages);

    // Processar ações
    const actionResults = [];
    const actionRegex = /```action\s*([\s\S]*?)```/g;
    let actionMatch;
    let cleanResposta = resposta;
    while ((actionMatch = actionRegex.exec(resposta)) !== null) {
      try {
        const actionData = JSON.parse(actionMatch[1].trim());
        const result = await executeAgentAction(actionData);
        actionResults.push(result);
        cleanResposta = cleanResposta.replace(actionMatch[0], '');
      } catch(e) {
        console.error('[Action] Erro:', e.message);
      }
    }
    if (actionResults.length > 0) {
      cleanResposta = cleanResposta.trim() + '\n\n' + actionResults.map(r => `✅ ${r}`).join('\n');
    }

    const agentMsg = {
      id: Date.now().toString(),
      role: 'agent',
      content: cleanResposta.trim(),
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const chatTable = getTable('chat');
    chatTable.push({ id: (Date.now()-1).toString(), role: 'user', content: message, ts: agentMsg.ts });
    chatTable.push(agentMsg);
    if (chatTable.length > 100) db['chat'] = chatTable.slice(-100);
    saveDb();

    res.json(agentMsg);
  } catch (error) {
    console.error('[Chat] Erro:', error);
    res.json({
      id: Date.now().toString(),
      role: 'agent',
      content: `❌ Erro na IA: ${error.message?.substring(0,200) || 'Verifique as API keys no .env'}`,
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }
});

async function executeAgentAction({ action, data }) {
  console.log(`[Action] ${action}:`, JSON.stringify(data));
  switch (action) {
    case 'create_lead': {
      const newLead = { id: Date.now().toString(), ...data, source: 'agent', status: data.status||'novo', created_at: new Date().toISOString(), last_stage_change: new Date().toISOString() };
      getTable('leads').push(newLead);
      saveDb();
      return `Lead "${data.name}" criado no CRM (ID: ${newLead.id})`;
    }
    case 'update_lead': {
      const leads = getTable('leads');
      const idx = leads.findIndex(l => l.id === data.id);
      if (idx > -1) { Object.assign(leads[idx], data, { updated_at: new Date().toISOString() }); saveDb(); return `Lead "${leads[idx].name}" atualizado`; }
      return `Lead ID ${data.id} não encontrado`;
    }
    case 'move_lead': {
      const leads = getTable('leads');
      const lead = leads.find(l => l.id === data.id);
      if (lead) { lead.status = data.status; lead.last_stage_change = new Date().toISOString(); saveDb(); return `Lead "${lead.name}" movido para "${data.status}"`; }
      return `Lead não encontrado`;
    }
    case 'delete_lead': {
      const before = getTable('leads').length;
      db['leads'] = getTable('leads').filter(l => l.id !== data.id);
      saveDb();
      return before > db['leads'].length ? `Lead removido` : `Lead ID ${data.id} não encontrado`;
    }
    case 'create_cadence': {
      const cad = { id: Date.now().toString(), ...data, created_at: new Date().toISOString() };
      getTable('cadences').push(cad);
      saveDb();
      return `Cadência "${data.name}" criada com ${data.cadence_steps?.length||0} passos`;
    }
    case 'add_to_outbound': {
      const lead = getTable('leads').find(l => l.id === data.crm_lead_id);
      if (!lead) return `Lead não encontrado`;
      const ob = { id: Date.now().toString(), crm_lead_id: lead.id, name: lead.name, company: lead.company, phone: lead.phone, email: lead.email, status: 'fila', cadencia_id: data.cadencia_id||'', cadencia_step: 1, channel: 'whatsapp', paused: false, last_contact: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() };
      getTable('ob_leads').push(ob);
      saveDb();
      return `"${lead.name}" adicionado ao outbound`;
    }
    case 'create_partner': {
      const p = { id: Date.now().toString(), ...data, created_at: new Date().toISOString() };
      getTable('partners').push(p);
      saveDb();
      return `Parceiro "${data.name}" criado`;
    }
    case 'add_faq': {
      getTable('knowledge_faq').push({ id: Date.now().toString(), ...data });
      saveDb();
      return `FAQ adicionada à base de conhecimento`;
    }
    case 'add_objection': {
      getTable('knowledge_objections').push({ id: Date.now().toString(), ...data });
      saveDb();
      return `Quebra de objeção adicionada`;
    }
    case 'create_indication': {
      const ind = {
        id: Date.now().toString(),
        referrer_name: data.referrer_name || '',
        referrer_contact: data.referrer_contact || '',
        referred_name: data.referred_name || '',
        referred_email: data.referred_email || '',
        referred_phone: data.referred_phone || '',
        referred_job: data.referred_job || '',
        referred_company: data.referred_company || '',
        message: data.message || '',
        status: data.status || 'warm',
        created_at: new Date().toISOString()
      };
      getTable('indications').push(ind);
      saveDb();
      return `Indicação criada: ${data.referred_name} (referidor: ${data.referrer_name})`;
    }
    case 'schedule_call': {
      const leads = getTable('leads');
      const lead = leads.find(l => l.id === data.lead_id);
      if (!lead) return `Lead não encontrado`;
      try {
        const resp = await fetch(`http://localhost:${process.env.PORT||3000}/api/calendly/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id, lead_name: lead.name, lead_email: data.lead_email || lead.email }),
        });
        const result = await resp.json();
        if (result.success) {
          lead.status = 'diagnostico_agendado';
          lead.last_stage_change = new Date().toISOString();
          saveDb();
          return `✅ Link de agendamento gerado para ${lead.name}: ${result.scheduling_url}`;
        }
        return `Não foi possível gerar link. Calendly configurado?`;
      } catch (e) {
        return `Erro ao conectar com Calendly MCP: ${e.message}`;
      }
    }
    case 'send_email': {
      try {
        const resp = await fetch(`http://localhost:${process.env.PORT||3000}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await resp.json();
        return result.success ? `✅ Email enviado para ${data.to}` : `Falha ao enviar email`;
      } catch (e) {
        return `Erro ao enviar email: ${e.message}`;
      }
    }
    case 'convert_indication': {
      const indications = getTable('indications');
      const ind = indications.find(i => i.id === data.id);
      if (!ind) return `Indicação não encontrada`;
      const newLead = {
        id: Date.now().toString(),
        name: ind.referred_name || 'Sem nome',
        company: ind.referred_company || '',
        phone: ind.referred_phone || '',
        email: ind.referred_email || '',
        job_title: ind.referred_job || '',
        main_pain: ind.message || '',
        source: 'indicacao',
        status: 'novo',
        partner_id: '',
        value: 0,
        linkedin_url: '',
        last_stage_change: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      getTable('leads').push(newLead);
      ind.status = 'converted';
      ind.converted_at = new Date().toISOString();
      ind.converted_lead_id = newLead.id;
      saveDb();
      return `Indicação convertida em lead: ${newLead.name}`;
    }
    case 'migrate_to_main': {
      const obLeads = getTable('ob_leads');
      const ob = obLeads.find(o => o.id === data.lead_id || o.crm_lead_id === data.lead_id);
      if (!ob) return `OB Lead não encontrado`;
      const leads = getTable('leads');
      const lead = leads.find(l => l.id === ob.crm_lead_id);
      db['ob_leads'] = obLeads.filter(o => o.id !== ob.id);
      if (lead) {
        lead.status = 'diagnostico_agendado';
        lead.last_stage_change = new Date().toISOString();
        lead.migrated_from_outbound = true;
      }
      saveDb();
      logActivity('migration', ob.crm_lead_id, `Lead "${ob.name}" migrado do outbound para pipeline principal (diagnostico_agendado)`);
      return `Lead "${ob.name}" migrado para pipeline principal`;
    }
    default:
      return `Ação "${action}" não reconhecida`;
  }
}

// ── 4. Dashboard com Métricas Reais ──
router.get('/dashboard', (req, res) => {
  const leads    = getTable('leads');
  const obLeads  = getTable('ob_leads');
  const cadences = getTable('cadences');
  const won      = leads.filter(l => l.status === 'sucesso');
  const lost     = leads.filter(l => l.status === 'recusado');
  const pipeline = leads.filter(l => !['sucesso','recusado'].includes(l.status));
  const revenue  = won.reduce((a,b) => a + Number(b.value||0), 0);
  res.json({
    status: 'online',
    leads_total: leads.length,
    leads_pipeline: pipeline.length,
    leads_won: won.length,
    leads_lost: lost.length,
    revenue,
    ob_total: obLeads.length,
    ob_active: obLeads.filter(l => !l.paused && l.status !== 'descartado').length,
    cadences_active: cadences.filter(c => c.status === 'Ativa').length,
    conversion_rate: leads.length > 0 ? Math.round((won.length/leads.length)*100) : 0
  });
});

// ── 5. Agent Config — (MOVED to after MCP_DEFAULTS definition, lines ~1261+) ──

// ── Sub-rotas Knowledge ──
const knowledgeKeys = ['urls','faq','objections','texts','observations'];
router.get('/knowledge/docs', (req, res) => res.json(getTable('knowledge_docs')));
router.delete('/knowledge/docs/:id', (req, res) => {
  db['knowledge_docs'] = getTable('knowledge_docs').filter(i => i.id !== req.params.id);
  saveDb(); res.json({ success: true });
});
knowledgeKeys.forEach(k => {
  router.get(`/knowledge/${k}`, (req, res) => res.json(getTable(`knowledge_${k}`)));
  router.post(`/knowledge/${k}`, (req, res) => {
    const item = { id: Date.now().toString(), ...req.body };
    getTable(`knowledge_${k}`).push(item); saveDb(); res.json(item);
  });
  router.put(`/knowledge/${k}/:id`, (req, res) => {
    const items = getTable(`knowledge_${k}`);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx > -1) { items[idx] = { ...items[idx], ...req.body }; saveDb(); res.json(items[idx]); }
    else res.status(404).json({ error: 'Not found' });
  });
  router.delete(`/knowledge/${k}/:id`, (req, res) => {
    db[`knowledge_${k}`] = getTable(`knowledge_${k}`).filter(i => i.id !== req.params.id);
    saveDb(); res.json({ success: true });
  });
});

// ── Outbound Migration ──
function migrateObToMain(obId) {
  const obLeads = getTable('ob_leads');
  const ob = obLeads.find(o => o.id === obId);
  if (!ob) return null;
  const leads = getTable('leads');
  const lead = leads.find(l => l.id === ob.crm_lead_id);
  
  ob.status = 'resposto';
  ob.paused = true;
  ob.lead_replied = true;
  
  if (lead) {
    lead.status = 'entrada_triagem';
    lead.last_stage_change = new Date().toISOString();
    lead.migrated_from_outbound = true;
  }
  saveDb();
  logActivity('migration', ob.crm_lead_id, `Lead "${ob.name}" migrado do outbound para pipeline principal`);
  return { ob, lead };
}

router.post('/outbound/migrate', (req, res) => {
  const { lead_id } = req.body;
  if (!lead_id) return res.status(400).json({ error: 'lead_id obrigatório' });
  const obLeads = getTable('ob_leads');
  const ob = obLeads.find(o => o.id === lead_id || o.crm_lead_id === lead_id);
  if (!ob) return res.status(404).json({ error: 'OB Lead não encontrado' });
  const result = migrateObToMain(ob.id);
  if (!result) return res.status(500).json({ error: 'Falha na migração' });
  res.json({ success: true, lead: result.lead, migrated_ob: result.ob });
});

router.put('/ob-leads/:id/reply', (req, res) => {
  const obLeads = getTable('ob_leads');
  const ob = obLeads.find(o => o.id === req.params.id);
  if (!ob) return res.status(404).json({ error: 'OB Lead não encontrado' });
  ob.lead_replied = true;
  saveDb();
  const result = migrateObToMain(ob.id);
  if (!result) return res.status(500).json({ error: 'Falha na migração' });
  res.json({ success: true, lead: result.lead, migrated_ob: result.ob });
});

// ── Outbound History ──
router.get('/ob-leads/:id/history', (req, res) => {
  res.json(getTable('ob_history').filter(h => h.ob_lead_id === req.params.id));
});
router.post('/ob-leads/:id/history', (req, res) => {
  const item = { id: Date.now().toString(), ob_lead_id: req.params.id, ...req.body, created_at: new Date().toISOString() };
  getTable('ob_history').push(item); saveDb(); res.json(item);
});

// ── Agendamento Próprio (G5X Booking) ──
// Sistema próprio de agendamento — sem depender de Calendly pago
// Gera links únicos, sincroniza com Google Calendar, envia lembretes

router.get('/booking/config', (req, res) => {
  const bookings = getTable('bookings_config');
  if (bookings.length === 0) {
    const defaultConfig = {
      id: 'default',
      closer_name: 'Closer G5X',
      closer_email: '',
      duration_minutes: 30,
      buffer_minutes: 15,
      timezone: 'America/Sao_Paulo',
      weekdays: [1,2,3,4,5], // Seg-Sex
      hours_start: '09:00',
      hours_end: '18:00',
      max_per_day: 8,
      google_calendar_id: '',
      google_credentials: '',
      auto_confirm: true,
      reminder_minutes: [60, 15], // 1h e 15min antes
      created_at: new Date().toISOString()
    };
    bookings.push(defaultConfig);
    saveDb();
  }
  // Não expor credentials
  const safe = { ...bookings[0] };
  delete safe.google_credentials;
  res.json(safe);
});

router.put('/booking/config', (req, res) => {
  const bookings = getTable('bookings_config');
  if (bookings.length === 0) {
    bookings.push({ id: 'default', ...req.body, created_at: new Date().toISOString() });
  } else {
    Object.assign(bookings[0], req.body, { updated_at: new Date().toISOString() });
  }
  saveDb();
  res.json({ success: true });
});

// Gerar slots disponíveis para uma data
router.get('/booking/slots/:date', async (req, res) => {
  const config = getTable('bookings_config')[0];
  if (!config) return res.status(400).json({ error: 'Configuração de agendamento não definida' });
  
  const date = req.params.date; // YYYY-MM-DD
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  
  // Verificar se é dia útil configurado
  if (!config.weekdays.includes(dayOfWeek)) {
    return res.json({ slots: [], reason: 'Dia não disponível' });
  }
  
  // Gerar slots
  const [startH, startM] = config.hours_start.split(':').map(Number);
  const [endH, endM] = config.hours_end.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const duration = config.duration_minutes + config.buffer_minutes;
  
  const slots = [];
  for (let min = startMin; min + config.duration_minutes <= endMin; min += duration) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    slots.push({ time: timeStr, available: true });
  }
  
  // Verificar bookings existentes
  const existingBookings = getTable('bookings').filter(b => b.date === date && b.status !== 'cancelled');
  for (const slot of slots) {
    if (existingBookings.find(b => b.time === slot.time)) {
      slot.available = false;
    }
  }
  
  // Limitar por dia
  if (existingBookings.length >= config.max_per_day) {
    slots.forEach(s => s.available = false);
  }
  
  res.json({ slots, date, config: { duration: config.duration_minutes, timezone: config.timezone } });
});

// Confirmar agendamento
router.post('/booking/confirm', async (req, res) => {
  const { lead_id, lead_name, lead_email, lead_phone, date, time, notes } = req.body;
  
  if (!date || !time) return res.status(400).json({ error: 'Data e hora obrigatórios' });
  
  const config = getTable('bookings_config')[0];
  const bookings = getTable('bookings');
  
  // Verificar se slot ainda está disponível
  const existing = bookings.find(b => b.date === date && b.time === time && b.status !== 'cancelled');
  if (existing) return res.status(409).json({ error: 'Horário já ocupado' });
  
  // Criar booking
  const booking = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    lead_id,
    lead_name,
    lead_email,
    lead_phone,
    date,
    time,
    duration: config?.duration_minutes || 30,
    notes: notes || '',
    status: 'confirmed',
    google_event_id: '',
    reminder_sent: false,
    created_at: new Date().toISOString(),
    booking_link: `${process.env.VPS_URL || 'http://2.24.71.246:3000'}/booking/confirm/${Date.now().toString(36)}`
  };
  
  bookings.push(booking);
  saveDb();
  
  // Atualizar lead
  const leads = getTable('leads');
  const lead = leads.find(l => l.id === lead_id);
  if (lead) {
    lead.status = 'diagnostico_agendado';
    lead.last_stage_change = new Date().toISOString();
    lead.scheduled_at = new Date().toISOString();
    lead.booking_id = booking.id;
    saveDb();
  }
  
  // Gerar briefing pré-call (async)
  try {
    await engine._generateBriefing(lead_id);
  } catch {}
  
  // Sincronizar com Google Calendar (se configurado)
  if (config?.google_calendar_id && config?.google_credentials) {
    try {
      const eventId = await syncToGoogleCalendar(config, booking);
      if (eventId) {
        booking.google_event_id = eventId;
        saveDb();
      }
    } catch (e) {
      console.log('[Booking] Google Calendar sync failed:', e.message);
    }
  }
  
  logActivity('booking', lead_id, `Agendamento confirmado: ${date} às ${time} com ${lead_name}`);
  
  res.json({ success: true, booking });
});

// Página pública de booking (para enviar ao lead)
router.get('/booking/page/:token', (req, res) => {
  const bookings = getTable('bookings');
  const booking = bookings.find(b => b.booking_link?.includes(req.params.token));
  if (!booking) return res.status(404).json({ error: 'Link inválido' });
  
  res.json({
    lead_name: booking.lead_name,
    date: booking.date,
    time: booking.time,
    duration: booking.duration,
    closer_name: getTable('bookings_config')[0]?.closer_name || 'Closer G5X',
    status: booking.status
  });
});

// Listar bookings
router.get('/bookings', (req, res) => {
  res.json(getTable('bookings'));
});

// Cancelar booking
router.put('/bookings/:id/cancel', (req, res) => {
  const bookings = getTable('bookings');
  const booking = bookings.find(b => b.id === req.params.id);
  if (booking) {
    booking.status = 'cancelled';
    booking.cancelled_at = new Date().toISOString();
    saveDb();
    
    // Reverter lead status
    const leads = getTable('leads');
    const lead = leads.find(l => l.id === booking.lead_id);
    if (lead && lead.status === 'diagnostico_agendado') {
      lead.status = 'entrada_triagem';
      saveDb();
    }
    
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Booking não encontrado' });
  }
});

// Sync com Google Calendar
async function syncToGoogleCalendar(config, booking) {
  const { googleapis } = require('googleapis');
  const auth = new googleapis.auth.GoogleAuth({
    credentials: JSON.parse(config.google_credentials),
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  
  const calendar = googleapis.calendar({ version: 'v3', auth });
  
  const startDateTime = `${booking.date}T${booking.time}:00`;
  const endDateTime = new Date(new Date(startDateTime).getTime() + booking.duration * 60000).toISOString();
  
  const event = {
    summary: `G5X - Diagnóstico: ${booking.lead_name}`,
    description: `Lead: ${booking.lead_name}\nEmpresa: ${booking.lead_name}\nTelefone: ${booking.lead_phone || 'N/A'}\nEmail: ${booking.lead_email || 'N/A'}\nNotas: ${booking.notes || ''}`,
    start: { dateTime: startDateTime, timeZone: config.timezone },
    end: { dateTime: endDateTime, timeZone: config.timezone },
    attendees: booking.lead_email ? [{ email: booking.lead_email }] : [],
    reminders: {
      useDefault: false,
      overrides: (config.reminder_minutes || [60, 15]).map(m => ({ method: 'popup', minutes: m })),
    },
  };
  
  const response = await calendar.events.insert({
    calendarId: config.google_calendar_id,
    requestBody: event,
  });
  
  return response.data.id;
}

// ── Email ──
router.post('/email/send', async (req, res) => {
  const { to, subject, message, template, vars } = req.body;
  try {
    const mcpsResponse = await fetch('http://localhost:3002/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message, template, vars }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await mcpsResponse.json();
    logActivity('email', null, `Email enviado para ${to}: "${subject}"`);
    res.json(data);
  } catch (e) {
    console.log(`[Email][SIMULADO] Para: ${to} | Assunto: ${subject}`);
    res.json({ success: true, simulated: true, to, subject });
  }
});

// ── Agent Engine Control ──
const { engine } = require('./agent');

router.get('/agent/status', (req, res) => {
  res.json(engine.getStatus());
});

router.post('/agent/start', async (req, res) => {
  try {
    await engine.start();
    res.json({ success: true, status: engine.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agent/stop', async (req, res) => {
  try {
    await engine.stop();
    res.json({ success: true, status: engine.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agent/log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = getTable('agent_log');
  res.json(logs.slice(-limit).reverse());
});

// Função auxiliar para server.js ler config diretamente
function getAgentConfigDirect() {
  try {
    const cfg = getTable('agent_config');
    return cfg[0] || null;
  } catch { return null; }
}

// ── LinkedIn ──
router.get('/linkedin/status', (req, res) => {
  res.json({
    configured: process.env.LINKEDIN_CONFIGURED === 'true',
    strategy: process.env.LINKEDIN_STRATEGY || 'api',
    has_api_key: !!process.env.LINKEDIN_API_KEY,
  });
});

// ── Move Lead Stage ──
router.put('/leads/:id/stage', (req, res) => {
  const leads = getTable('leads');
  const lead = leads.find(l => l.id === req.params.id);
  if (lead) { lead.status = req.body.status; lead.last_stage_change = new Date().toISOString(); saveDb(); res.json(lead); }
  else res.status(404).json({ error: 'Lead not found' });
});
// ── Agent Config (dedicated routes — bridge sends PUT without ID) ──
const MCP_DEFAULTS = {
  whatsapp: { enabled: false, label: 'WhatsApp' },
  email: { enabled: false, label: 'Email SMTP' },
  linkedin: { enabled: false, label: 'LinkedIn' },
  instagram: { enabled: false, label: 'Instagram' },
  calendly: { enabled: false, label: 'Calendly' }
};

function ensureMcpDefaults(config) {
  if (!config.mcps) config.mcps = {};
  for (const [k, v] of Object.entries(MCP_DEFAULTS)) {
    if (!config.mcps[k]) config.mcps[k] = { ...v };
  }
}

router.get('/agent-config', (req, res) => {
  const configs = getTable('agent_config');
  if (configs.length === 0) {
    const def = { id: Date.now().toString(), nome: 'Madalena', persona: 'SDR consultivo especialista em vendas B2B outbound', running: false, horario_inicio: '08:00', horario_fim: '18:00', mcps: { ...MCP_DEFAULTS }, created_at: new Date().toISOString() };
    Object.keys(MCP_DEFAULTS).forEach(k => def.mcps[k] = { ...MCP_DEFAULTS[k] });
    configs.push(def);
    saveDb();
  }
  ensureMcpDefaults(configs[0]);
  saveDb();
  res.json(configs[0]);
});

router.put('/agent-config', (req, res) => {
  const configs = getTable('agent_config');
  if (configs.length === 0) {
    const newCfg = { id: Date.now().toString(), ...req.body, created_at: new Date().toISOString() };
    ensureMcpDefaults(newCfg);
    configs.push(newCfg);
  } else {
    Object.assign(configs[0], req.body, { updated_at: new Date().toISOString() });
    ensureMcpDefaults(configs[0]);
  }
  saveDb();
  res.json(configs[0]);
});

// ── CRUD Genérico ──
router.get('/:table', (req, res) => {
  let table = req.params.table.replace(/-/g, '_');
  res.json(getTable(table));
});
router.get('/:table/:id', (req, res) => {
  let table = req.params.table.replace(/-/g, '_');
  res.json(getTable(table).find(i => i.id === req.params.id) || null);
});
router.post('/:table', (req, res) => {
  let table = req.params.table.replace(/-/g, '_');
  const newItem = { id: Date.now().toString(), ...req.body, created_at: new Date().toISOString() };
  getTable(table).push(newItem); saveDb(); res.json(newItem);
});
router.put('/:table/:id', (req, res) => {
  let table = req.params.table.replace(/-/g, '_');
  const items = getTable(table);
  const index = items.findIndex(i => i.id === req.params.id);
  if (index > -1) { items[index] = { ...items[index], ...req.body, updated_at: new Date().toISOString() }; saveDb(); res.json(items[index]); }
  else res.status(404).json({ error: 'Not found' });
});
router.delete('/:table/:id', (req, res) => {
  let table = req.params.table.replace(/-/g, '_');
  db[table] = getTable(table).filter(i => i.id !== req.params.id);
  saveDb(); res.json({ success: true });
});

module.exports = router;
module.exports.getAgentConfigDirect = getAgentConfigDirect;
