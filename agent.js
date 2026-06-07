require('dotenv').config();
const dbm = require('./tools/db');

// ═══════════════════════════════════════════════════════════════
// DATA RACE FIX: agent.js usa o mesmo DB centralizado (tools/db.js)
// que api.js. Ambos compartilham locks, cache e write queue.
// NUNCA declare variáveis 'data' globais — sempre use dbm.readDb().
// ═══════════════════════════════════════════════════════════════

let data = {};
function loadDb() { data = dbm.readDb(); }
function saveDb() { dbm.writeDb(data); }
function getTable(name) {
  const db = data && Object.keys(data).length > 0 ? data : dbm.readDb();
  if (!db[name]) db[name] = [];
  if (db !== data) data = db;
  return data[name];
}
function pushTable(name, item) {
  data = dbm.readDb();
  if (!data[name]) data[name] = [];
  data[name].push(item);
  dbm.writeDb(data);
  return item;
}
loadDb();

// ── Log ──
function engineLog(action, detail, target = null, meta = {}) {
  const entry = {
    id: dbm.genId(),
    action,
    detail,
    target,
    log_date: new Date().toISOString().split('T')[0],
    log_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    meta,
  };
  loadDb();
  if (!data.agent_log) data.agent_log = [];
  data.agent_log.push(entry);
  if (data.agent_log.length > 500) data.agent_log = data.agent_log.slice(-500);
  saveDb();
  console.log(`[Engine] ${action}: ${detail}`);
  return entry;
}

// ── MCPs ──
const MCPS = [
  { name: 'WhatsApp', port: 3001 },
  { name: 'Email', port: 3002 },
  { name: 'LinkedIn', port: 3003 },
  { name: 'Calendly', port: 3004 },
];

// ── Agent Engine ──
class AgentEngine {
  constructor() {
    this._interval = null;
    this._running = false;
    this._heartbeatCount = 0;
    this._startedAt = null;
    this._lastHeartbeat = null;
    this._status = 'stopped';
    this._mcpStatus = {};
    this.HEARTBEAT_MS = (parseInt(process.env.AGENT_HEARTBEAT_SECONDS) || 120) * 1000;
    // Bot detection state
    this._botDetectionMap = new Map();
    // Live action stream
    this._liveActions = [];
    // LLM offline state
    this._llmOffline = false;
    this._llmFailCount = 0;
    // MCP circuit breaker
    this._mcpCircuitBreaker = {};
    this._lastMcpCheck = 0;
  }

  // ── Startup ──
  async start() {
    if (this._running) return;
    console.log('\n═══════════════════════════════════════════');
    console.log('  🚀 G5X ENGENHO AUTÔNOMO - INICIANDO');
    console.log('═══════════════════════════════════════════\n');

    loadDb();
    const cfg = getTable('agent_config');
    if (cfg[0]) { cfg[0].running = true; cfg[0].started_at = new Date().toISOString(); }
    saveDb();

    this._running = true;
    this._status = 'running';
    this._startedAt = new Date().toISOString();

    await this._checkAllMCPs();
    await this._heartbeat();

    this._interval = setInterval(() => this._heartbeat(), this.HEARTBEAT_MS);

    engineLog('ENGINE_START', `Engenho autônomo iniciado. Heartbeat a cada ${this.HEARTBEAT_MS/1000}s`);
    console.log(`[Engine] Heartbeat a cada ${this.HEARTBEAT_MS / 1000}s\n`);
  }

  async stop() {
    if (!this._running) return;
    this._running = false;
    this._status = 'stopped';
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    loadDb();
    const cfg = getTable('agent_config');
    if (cfg[0]) { cfg[0].running = false; }
    saveDb();

    engineLog('ENGINE_STOP', 'Engenho autônomo parado.');
    console.log('\n[Engine] ⛔ Engenho autônomo parado.\n');
  }

  getStatus() {
    return {
      running: this._running,
      status: this._status,
      heartbeatCount: this._heartbeatCount,
      startedAt: this._startedAt,
      lastHeartbeat: this._lastHeartbeat,
      mcpStatus: this._mcpStatus,
      intervalMs: this.HEARTBEAT_MS,
      liveActions: this._liveActions.slice(-10),
      llmOffline: this._llmOffline,
      llmFailCount: this._llmFailCount,
    };
  }

  // ── Live Action Stream (for floating chat mirror) ──
  _pushLiveAction(text) {
    this._liveActions.push({ text, ts: Date.now() });
    if (this._liveActions.length > 50) this._liveActions = this._liveActions.slice(-50);
  }

  // ── MCP Health Check ──
  async _checkAllMCPs() {
    const results = await Promise.all(MCPS.map(async (mcp) => {
      try {
        const resp = await fetch(`http://localhost:${mcp.port}/health`, { signal: AbortSignal.timeout(3000) });
        const data = await resp.json();
        this._mcpStatus[mcp.name] = { online: true, configured: data.configured, simulated: data.simulated };
        return { ...mcp, online: true, ...data };
      } catch {
        this._mcpStatus[mcp.name] = { online: false, configured: false };
        return { ...mcp, online: false };
      }
    }));
    const online = results.filter(r => r.online).length;
    console.log(`[Engine] MCPs: ${online}/${MCPS.length} online`);
    return results;
  }

  async _refreshMcpStatus() {
    if (Date.now() - this._lastMcpCheck > 300000) {
      this._lastMcpCheck = Date.now();
      await this._checkAllMCPs();
    }
  }

  // ── Heartbeat ──
  async _heartbeat() {
    if (!this._running) return;

    const startTime = Date.now();
    this._heartbeatCount++;
    this._lastHeartbeat = new Date().toISOString();

    await this._refreshMcpStatus();

    const tasks = [];

    try {
      const config = getTable('agent_config')[0];
      if (!config || !config.running) {
        if (this._running) {
          console.log('[Engine] agent_config.running=false — parando...');
          await this.stop();
        }
        return;
      }

      if (!this._isWithinWorkingHours(config)) {
        if (this._heartbeatCount % 10 === 0) {
          console.log(`[Engine] Fora do horário de trabalho (${config.horario_inicio}-${config.horario_fim})`);
        }
        return;
      }

      // 1. Process cadences (outbound)
      const cadResult = await this._processCadences(config);
      if (cadResult) tasks.push(cadResult);

      // 2. Check stalled leads
      const stalledResult = this._checkStalledLeads();
      if (stalledResult) tasks.push(stalledResult);

      // 3. Auto-route new cold leads
      const routeResult = this._autoRouteNewLeads();
      if (routeResult) tasks.push(routeResult);

      // 4. Process indicações quentes (NEW)
      const indicResult = await this._processIndicacoes(config);
      if (indicResult) tasks.push(indicResult);

      // 5. Process HIL queue (NEW)
      const hilResult = this._processHILQueue();
      if (hilResult) tasks.push(hilResult);

      // 6. Geladeira hygiene check (NEW)
      const gelResult = this._checkGeladeiraHygiene();
      if (gelResult) tasks.push(gelResult);

      // 7. Bot re-evaluation (NEW)
      const botResult = await this._reEvaluateBotContacts();
      if (botResult) tasks.push(botResult);

      const elapsed = Date.now() - startTime;
      if (tasks.length > 0) {
        engineLog('HEARTBEAT', `#${this._heartbeatCount} — ${tasks.join(' | ')} (${elapsed}ms)`);
      }

    } catch (err) {
      this._status = 'error';
      engineLog('ENGINE_ERROR', `Heartbeat #${this._heartbeatCount}: ${err.message}`);
      console.error('[Engine] Erro no heartbeat:', err.message);
    }
  }

  // ── Working hours check ──
  _isWithinWorkingHours(config) {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const start = (config.horario_inicio || '08:00').split(':').map(Number);
    const end = (config.horario_fim || '18:00').split(':').map(Number);
    const nowMin = h * 60 + m;
    const startMin = start[0] * 60 + (start[1] || 0);
    const endMin = end[0] * 60 + (end[1] || 0);
    return nowMin >= startMin && nowMin <= endMin;
  }

  // ── 3. Process Cadences (UPDATED: multi-contact, bot detection, polymorphism) ──
  async _processCadences(config) {
    loadDb();
    const obLeads = data.ob_leads || [];
    const cadences = data.cadences || [];
    const agora = Date.now();
    const maxPerHeartbeat = parseInt(config.max_per_cycle || process.env.AGENT_MAX_PER_CYCLE || '5');
    let sent = 0;

    for (const ob of obLeads) {
      if (sent >= maxPerHeartbeat) break;
      if (ob.paused) continue;
      if (['descartado', 'convertido'].includes(ob.status)) continue;

      // Bot freeze check
      if (ob.bot_freeze_until && new Date(ob.bot_freeze_until).getTime() > agora) continue;

      if (ob.lead_replied === true) {
        const lead = (data.leads || []).find(l => l.id === ob.crm_lead_id);
        if (lead) {
          lead.status = 'entrada_triagem';
          lead.last_stage_change = new Date().toISOString();
          lead.migrated_from_outbound = true;
        }
        ob.status = 'resposto';
        ob.paused = true;
        engineLog('OB_MIGRATION', `${ob.name} migrado para pipeline principal (lead respondeu)`, ob.name);
        this._pushLiveAction(`📥 ${ob.name} migrado para Entrada & Triagem`);
        continue;
      }

      const cadence = cadences.find(c => c.id === ob.cadencia_id);
      if (!cadence || cadence.status !== 'Ativa') continue;
      if (!cadence.cadence_steps || cadence.cadence_steps.length === 0) continue;

      const stepIndex = (ob.cadencia_step || 1) - 1;
      if (stepIndex >= cadence.cadence_steps.length) {
        this._moveToGeladeira(ob, 'Cadência completa (todos os passos executados)', '#Gelo_Cadencia_Completa');
        continue;
      }

      const step = cadence.cadence_steps[stepIndex];
      const lastContact = ob.last_contact ? new Date(ob.last_contact).getTime() : (ob.created_at ? new Date(ob.created_at).getTime() : agora);
      const daysSinceLastContact = (agora - lastContact) / 86400000;
      const waitDays = step.timing_days || (step.day !== undefined ? step.day : 1);

      if (daysSinceLastContact < waitDays) continue;

      // Get lead data (now supports account-based with contacts)
      const lead = (data.leads || []).find(l => l.id === ob.crm_lead_id);
      const contactData = this._getContactData(ob, lead);

      // Render template
      const messageText = this._renderTemplate(step.message_template || '', {
        firstName: contactData.name?.split(' ')[0] || contactData.name,
        name: contactData.name,
        company: ob.company || lead?.company,
        pain: lead?.main_pain || '',
        valor: lead?.value ? `R$ ${Number(lead.value).toLocaleString('pt-BR')}` : '',
      });

      // Polymorphism: retexturize message via LLM using the Tacit Knowledge Protocol (NEW)
      const finalMessage = await this.generateAutonomousResponse(messageText, {
        company: ob.company || lead?.company,
        contactName: contactData.name,
        leadId: lead?.id,
        main_pain: lead?.main_pain || '',
        segmento: lead?.industry || ''
      });

      const result = await this._sendMessage(ob, step.channel, finalMessage, config, contactData);
      if (result) {
        sent++;

        const histEntry = {
          id: dbm.genId(),
          ob_lead_id: ob.id,
          lead_id: lead?.id,
          action_text: `💬 Passo ${stepIndex+1}: ${step.label || step.channel} — ${result.status}`,
          action_date: new Date().toISOString().split('T')[0],
          channel: step.channel,
          direction: 'out',
          message_preview: finalMessage.substring(0, 100),
        };
        if (!data.ob_history) data.ob_history = [];
        data.ob_history.push(histEntry);

        ob.cadencia_step = (ob.cadencia_step || 1) + 1;
        ob.last_contact = new Date().toISOString().split('T')[0];
        ob.last_channel = step.channel;

        if (ob.cadencia_step > cadence.cadence_steps.length) {
          this._moveToGeladeira(ob, 'Cadência concluída automaticamente', '#Gelo_Cadencia_Completa');
        }
      }
    }

    if (sent > 0) {
      saveDb();
      return `${sent} mensagens enviadas`;
    }
    return null;
  }

  // ── Get contact data from account-based lead ──
  _getContactData(ob, lead) {
    if (ob.contact_id && lead?.contacts) {
      const contact = lead.contacts.find(c => c.id === ob.contact_id);
      if (contact) return contact;
    }
    return {
      id: 'primary',
      name: ob.name || lead?.name,
      email: ob.email || lead?.email,
      phone: ob.phone || lead?.phone,
      job_title: ob.job_title || lead?.job_title,
      is_primary: true,
    };
  }

  // ── generateAutonomousResponse: retexturize message using Tacit Knowledge Protocol (RAG) ──
  async generateAutonomousResponse(originalMessage, leadContext) {
    if (this._llmOffline) {
      return originalMessage;
    }

    try {
      const llm = require('./tools/llm');
      const rag = require('./tools/rag');

      // Buscar contexto relevante da base de conhecimento
      let ragContext = '';
      try {
        const queryText = `${leadContext.main_pain || ''} ${originalMessage}`;
        const ragResults = await rag.findRelevantContextString(queryText, 2);
        if (ragResults) {
          ragContext = ragResults.substring(0, 4000);
        }
      } catch (ragErr) {
        console.warn('[Engine][RAG] Falha ao buscar contexto para resposta autônoma:', ragErr.message);
      }

      const systemPrompt = `Você é a Madalena, inteligência SDR sênior da operação G5X. Você recebeu uma base de conhecimento especializada sobre o GERIC FAST e alavancagem de construtoras. 
DIRETRIZ DE SEGURANÇA: Use esta base exclusivamente para guiar sua estratégia de contra-ataque lógico, argumentos de negócios e quebra de objeções. Não cite autores, não diga 'segundo o documento X', e não reproduza trechos de livros. Converse de forma natural, executiva, limpa e focada em extrair o agendamento da reunião. Demonstre autoridade através da segurança e precisão do seu raciocínio, não por exibição de conteúdo acadêmico.`;

      const userPrompt = `Reescreva e calibre a mensagem comercial abaixo para torná-la altamente persuasiva, natural e adequada ao lead.
Use a base de conhecimento de background para calibrar o jargão técnico e o tom executivo (Diretor/Sócio de Negócios experiente), focando em agendar uma reunião comercial (call de 15 minutos).

Base de Conhecimento Técnica (Background de Inteligência):
${ragContext || 'Nenhuma informação específica no momento.'}

Informações do Lead:
- Nome: ${leadContext.contactName || 'Responsável'}
- Construtora: ${leadContext.company || 'N/A'}
- Segmento: ${leadContext.segmento || 'Construção Civil'}
- Dor Principal: ${leadContext.main_pain || 'N/A'}

Mensagem Original a ser calibrada:
"${originalMessage}"

Retorne APENAS a mensagem comercial final calibrada, pronta para envio, sem introduções ou explicações.`;

      const result = await llm.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      this._llmFailCount = 0;
      this._llmOffline = false;
      return result.trim() || originalMessage;
    } catch (e) {
      this._llmFailCount++;
      if (this._llmFailCount >= 3) {
        this._llmOffline = true;
        console.warn('[Engine] LLM offline — operando em modo básico');
      }
      return originalMessage; // Fallback: use original
    }
  }

  // Mantido para compatibilidade e retrocompatibilidade
  async _polymorphMessage(message, company, contactName) {
    return this.generateAutonomousResponse(message, { company, contactName });
  }

  // ── 3a. Send Message via MCP (UPDATED: bot detection, pacing, circuit breaker, MCP toggles) ──
  async _sendMessage(ob, channel, message, config, contactData) {
    // MCP toggle check — skip if channel is disabled in config
    const mcpMap = { whatsapp: 'whatsapp', email: 'email', linkedin: 'linkedin' };
    const mcpKey2 = mcpMap[channel];
    if (mcpKey2 && config?.mcps && config.mcps[mcpKey2] && config.mcps[mcpKey2].enabled === false) {
      console.log(`[Engine] MCP ${channel} desabilitado na config — pulando envio`);
      return { status: 'pulado', channel, reason: 'mcp_disabled' };
    }

    // Human-like pacing (NEW)
    const baseDelay = (config?.delay_min || 5) * 1000;
    const randomDelay = baseDelay + Math.random() * (config?.delay_max || 180) * 100;
    await new Promise(r => setTimeout(r, randomDelay));

    const maxLen = channel === 'whatsapp' ? 1000 : 10000;
    const truncatedMsg = message.substring(0, maxLen);

    // MCP circuit breaker check
    const mcpKey = channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : channel;
    if (this._isMcpCircuitOpen(mcpKey)) {
      console.warn(`[Engine] MCP ${mcpKey} circuit open — simulando envio`);
      return { status: 'simulado', channel, simulated: true, reason: 'circuit breaker' };
    }

    try {
      if (channel === 'whatsapp') {
        if (this._mcpStatus['WhatsApp']?.online) {
          const phone = contactData?.phone || ob.phone;
          if (!phone) return { status: 'pulado', channel: 'whatsapp', reason: 'sem telefone' };

          const resp = await fetch('http://localhost:3001/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: phone, message: truncatedMsg }),
            signal: AbortSignal.timeout(10000),
          });
          const data = await resp.json();
          this._recordMcpSuccess(mcpKey);
          return { status: data.success ? 'enviado' : 'falha', channel: 'whatsapp', simulated: data.simulated };
        }
        return { status: 'simulado', channel: 'whatsapp', simulated: true };
      }
      else if (channel === 'email') {
        if (this._mcpStatus['Email']?.online) {
          const email = contactData?.email || ob.email;
          if (!email) return { status: 'pulado', channel: 'email', reason: 'sem email' };

          const resp = await fetch('http://localhost:3002/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: email, subject: `G5X | ${ob.company || 'Oportunidade'}`, message: truncatedMsg }),
            signal: AbortSignal.timeout(10000),
          });
          const data = await resp.json();
          this._recordMcpSuccess(mcpKey);
          return { status: data.success ? 'enviado' : 'falha', channel: 'email', simulated: data.simulated };
        }
        return { status: 'simulado', channel: 'email', simulated: true };
      }
      else if (channel === 'linkedin') {
        if (this._mcpStatus['LinkedIn']?.online) {
          const linkedinProfile = contactData?.linkedin || ob.linkedin;
          if (!linkedinProfile) return { status: 'pulado', channel: 'linkedin', reason: 'sem perfil' };

          const resp = await fetch('http://localhost:3003/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: linkedinProfile, message: truncatedMsg }),
            signal: AbortSignal.timeout(10000),
          });
          const data = await resp.json();
          this._recordMcpSuccess(mcpKey);
          return { status: data.success ? 'enviado' : 'falha', channel: 'linkedin', simulated: data.simulated };
        }
        return { status: 'simulado', channel: 'linkedin', simulated: true };
      }
      return { status: 'pulado', channel: 'desconhecido' };
    } catch (err) {
      this._recordMcpFailure(mcpKey);
      console.warn(`[Engine] Falha ao enviar ${channel} para ${ob.name}: ${err.message}`);
      return { status: 'erro', channel, error: err.message };
    }
  }

  // ── MCP Circuit Breaker ──
  _isMcpCircuitOpen(mcpName) {
    const circuit = this._mcpCircuitBreaker[mcpName];
    if (!circuit) return false;
    if (!circuit.open) return false;
    if (Date.now() - circuit.lastFailure > 5 * 60 * 1000) {
      circuit.open = false;
      circuit.failures = 0;
      return false;
    }
    return true;
  }

  _recordMcpFailure(mcpName) {
    if (!this._mcpCircuitBreaker[mcpName]) {
      this._mcpCircuitBreaker[mcpName] = { failures: 0, open: false };
    }
    const circuit = this._mcpCircuitBreaker[mcpName];
    circuit.failures++;
    circuit.lastFailure = Date.now();
    if (circuit.failures >= 3) {
      circuit.open = true;
      console.warn(`[Engine] Circuit breaker OPEN para MCP ${mcpName}`);
    }
  }

  _recordMcpSuccess(mcpName) {
    if (this._mcpCircuitBreaker[mcpName]) {
      this._mcpCircuitBreaker[mcpName].failures = 0;
      this._mcpCircuitBreaker[mcpName].open = false;
    }
  }

  // ── 3b. Move to Geladeira (UPDATED: with tags) ──
  _moveToGeladeira(ob, reason, tag = '#Gelo_Geral') {
    loadDb();
    if (!data.geladeira) data.geladeira = [];
    const gelEntry = {
      ...ob,
      reason,
      geladeira_tag: tag,
      entered_at: new Date().toISOString().split('T')[0],
      geladeira_entered_ts: new Date().toISOString(),
    };
    data.geladeira.push(gelEntry);
    data.ob_leads = data.ob_leads.filter(o => o.id !== ob.id);
    engineLog('GELADEIRA', `${ob.name} → geladeira: ${reason} [${tag}]`, ob.name);
  }

  // ── 4. Check Stalled Leads ──
  _checkStalledLeads() {
    loadDb();
    const leads = data.leads || [];
    const hoje = Date.now();
    const LIMITE_DIAS = 7;
    const stalled = leads.filter(l => {
      if (['credito_na_tela', 'perdido_arquivado'].includes(l.status)) return false;
      const change = l.last_stage_change ? new Date(l.last_stage_change).getTime() : (l.created_at ? new Date(l.created_at).getTime() : hoje);
      return (hoje - change) / 86400000 >= LIMITE_DIAS;
    });

    if (stalled.length > 0) {
      engineLog('STALLED', `${stalled.length} leads estagnados (+${LIMITE_DIAS}d): ${stalled.slice(0,5).map(l=>l.name).join(', ')}${stalled.length>5?`... +${stalled.length-5}`:''}`);
      return `${stalled.length} estagnados`;
    }
    return null;
  }

  // ── 5. Auto-route new cold leads (UPDATED: account-based) ──
  _autoRouteNewLeads() {
    loadDb();
    const leads = data.leads || [];
    const obLeads = data.ob_leads || [];
    const cadences = data.cadences || [];

    const activeCadence = cadences.find(c => c.status === 'Ativa');
    if (!activeCadence) return null;

    const isIndicacao = l => l.source === 'indicacao' || l.indicacao_origem;
    const candidates = leads.filter(l =>
      l.status === 'entrada_triagem' &&
      !isIndicacao(l) &&
      !obLeads.find(ob => ob.crm_lead_id === l.id)
    );

    if (candidates.length === 0) return null;

    let added = 0;
    for (const lead of candidates) {
      if (obLeads.find(ob => ob.crm_lead_id === lead.id)) continue;

      // Account-based: create ob_lead for each contact
      const contacts = lead.contacts || [{ id: 'primary', name: lead.name, email: lead.email, phone: lead.phone, job_title: lead.job_title, is_primary: true }];

      for (const contact of contacts) {
        if (!contact.name && !contact.email && !contact.phone) continue;

        const newOb = {
          id: dbm.genId() + '-' + contact.id,
          crm_lead_id: lead.id,
          contact_id: contact.id,
          name: contact.name || lead.name,
          company: lead.company || '',
          phone: contact.phone || lead.phone || '',
          email: contact.email || lead.email || '',
          linkedin_url: lead.linkedin_url || '',
          job_title: contact.job_title || lead.job_title || '',
          status: 'fila',
          last_contact: new Date().toISOString().split('T')[0],
          cadencia_step: 1,
          cadencia_id: activeCadence.id,
          channel: contact.email ? 'email' : 'whatsapp',
          paused: false,
          created_at: new Date().toISOString(),
        };
        data.ob_leads.push(newOb);
        added++;
      }
    }

    if (added > 0) {
      saveDb();
      engineLog('AUTO_ROUTE', `${added} contatos de leads frios adicionados à cadência "${activeCadence.name}"`);
      return `${added} auto-roteados`;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════
  // NEW MODULES
  // ═══════════════════════════════════════════════════

  // ── 6. Bot Detection & Smart Pause (NEW) ──
  async _detectBot(message) {
    // Heuristic fallback when LLM is offline
    if (this._llmOffline) {
      return this._detectBotHeuristic(message);
    }

    try {
      const llm = require('./tools/llm');
      const prompt = `Analise esta mensagem e determine se veio de um bot/sistema automatizado ou de um humano.

Mensagem: "${message}"

Retorne JSON:
{"is_bot": true/false, "bot_type": "chatbot_comercial|ia_atendimento|ausencia|menu_transbordo|humano", "confidence": 0-100, "reason": "breve explicação"}`;

      const result = await llm.chat([
        { role: 'system', content: 'You are a bot detection assistant. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        this._llmFailCount = 0;
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this._llmFailCount++;
      if (this._llmFailCount >= 3) {
        this._llmOffline = true;
        console.warn('[Engine] LLM offline — usando detecção de bot heurística');
      }
    }

    return this._detectBotHeuristic(message);
  }

  // ── Heuristic Bot Detection (LLM offline fallback) ──
  _detectBotHeuristic(message) {
    const lower = message.toLowerCase();
    const botPatterns = [
      { pattern: /auto[- ]?resposta|mensagem autom/i, type: 'ausencia', weight: 90 },
      { pattern: /para falar com \w+|digite \d|menu|opção/i, type: 'menu_transbordo', weight: 85 },
      { pattern: /chatbot|assistente virtual|ia de atendimento/i, type: 'ia_atendimento', weight: 80 },
      { pattern: /horário de atendimento|seg a sex|segunda a sexta|das \d+ às \d+/i, type: 'chatbot_comercial', weight: 75 },
      { pattern: /não estamos disponíveis|momento indisponível|ligação será gravada/i, type: 'chatbot_comercial', weight: 70 },
      { pattern: /olá, sou o|oi, eu sou o|bem-vindo ao|você está falando com/i, type: 'chatbot_comercial', weight: 65 },
    ];

    for (const { pattern, type, weight } of botPatterns) {
      if (pattern.test(lower)) {
        return { is_bot: true, bot_type: type, confidence: weight, reason: 'Padrão heurístico detectado' };
      }
    }

    return { is_bot: false, bot_type: 'humano', confidence: 60, reason: 'Sem padrões de bot detectados' };
  }

  // ── Handle Incoming Message (UPDATED: bot detection, bypass strategy) ──
  async handleIncomingMessage(leadId, message, source) {
    return dbm.withLeadLock(leadId, async () => {
    loadDb();
    const obLeads = data.ob_leads || [];
    const ob = obLeads.find(o => o.crm_lead_id === leadId);

    engineLog('INCOMING', `Mensagem de lead ${leadId}: "${message.substring(0,80)}..."`, leadId);

    // Bot detection (NEW)
    const botAnalysis = await this._detectBot(message);
    const phoneKey = ob?.phone || leadId;

    if (botAnalysis.is_bot && botAnalysis.confidence > 70) {
      const botState = this._botDetectionMap.get(phoneKey) || { attempts: 0, bypassed: false };
      botState.attempts++;

      this._pushLiveAction(`🤖 Bot detectado para ${ob?.name || leadId}. Analisando diálogo para alcançar um humano...`);
      engineLog('BOT_DETECTED', `Bot detectado: ${botAnalysis.bot_type}. Tentativa ${botState.attempts} de contorno.`, ob?.name);

      let responseToBot = 'falar com o responsável'; // default fallback

      // Ask LLM how to bypass this bot
      try {
        const llm = require('./tools/llm');
        const prompt = `Você está interagindo com um chatbot/atendimento automático do cliente.
Mensagem do bot: "${message}"

Determine a melhor resposta para contornar esse bot e chegar a um atendente humano.
- Se houver um menu de opções (ex: "1 para X, 2 para Y"), escolha o número correspondente à opção comercial/responsável/humano.
- Caso contrário, gere uma frase direta e educada para pedir atendimento humano (ex: "Gostaria de falar com o responsável comercial", "Por favor, me transfira para um atendente").
- Retorne APENAS a resposta final (seja o número ou a frase) que deve ser enviada ao chat, sem nenhuma explicação ou aspas adicionais.`;

        const llmRes = await llm.chat([
          { role: 'system', content: 'Você é um assistente de transbordo humano. Retorne apenas o texto exato da resposta.' },
          { role: 'user', content: prompt }
        ]);

        if (llmRes && llmRes.trim().length > 0) {
          responseToBot = llmRes.trim().replace(/^["']|["']$/g, ''); // strip quotes
        }
      } catch (e) {
        console.warn('[Engine] Falha ao gerar resposta de transbordo via LLM:', e.message);
      }

      if (ob) {
        ob.bot_attempts = (ob.bot_attempts || 0) + 1;
        ob.bot_freeze_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        if (ob.bot_attempts >= 3) {
          this._moveToGeladeira(ob, 'Bot persistente após 3 tentativas de transbordo', '#Gelo_Bot_Loop');
          engineLog('BOT_GAVE_UP', `Bot irredutível após ${ob.bot_attempts} tentativas — ${ob.name} movido para geladeira`, ob.name);
          this._pushLiveAction(`🤖 Bot irredutível: ${ob.name} movido para geladeira`);
          saveDb();
          return { paused: true, bot_detected: true, gave_up: true };
        }

        await this._sendMessage(ob, 'whatsapp', responseToBot, {}, { phone: ob.phone });
        engineLog('BOT_BYPASS', `Enviando resposta ao bot: "${responseToBot}" (Tentativa ${ob.bot_attempts}/3)`, ob.name);
        
        // Registrar no histórico
        const histEntry = {
          id: dbm.genId(),
          ob_lead_id: ob.id,
          action_text: `🤖 Resposta automática ao chatbot: "${responseToBot}" (Tentativa ${ob.bot_attempts}/3)`,
          action_date: new Date().toISOString().split('T')[0],
          channel: 'whatsapp',
          direction: 'out',
          message_preview: responseToBot.substring(0, 200),
        };
        if (!data.ob_history) data.ob_history = [];
        data.ob_history.push(histEntry);
        saveDb();
      }

      this._botDetectionMap.set(phoneKey, botState);
      
      // Permanecer na cadência (paused: false)
      return { paused: false, bot_detected: true, response_sent: responseToBot };
    }

    // Human response — reset bot state
    if (this._botDetectionMap.has(phoneKey) || (ob && ob.bot_attempts)) {
      this._botDetectionMap.delete(phoneKey);
      if (ob) {
        ob.bot_freeze_until = null;
        ob.bot_attempts = 0;
        saveDb();
      }
    }

    // Human responded — pause cadence and migrate to main pipeline
    if (ob) {
      ob.paused = true;
      ob.status = 'resposto'; // Move to Resposto stage in Outbound Pipeline
      ob.lead_replied = true;

      // Migrate corresponding CRM lead to the main pipeline ('entrada_triagem')
      const leads = data.leads || [];
      const lead = leads.find(l => l.id === ob.crm_lead_id);
      if (lead) {
        lead.status = 'entrada_triagem'; // Enter main pipeline
        lead.last_stage_change = new Date().toISOString();
        lead.migrated_from_outbound = true;
        engineLog('MIGRATION', `Lead "${ob.name}" migrado para o pipeline principal (entrada_triagem)`, ob.name);
      }

      const histEntry = {
        id: dbm.genId(),
        ob_lead_id: ob.id,
        action_text: `📥 Resposta humana recebida. Cadência concluída e lead migrado para o pipeline principal.`,
        action_date: new Date().toISOString().split('T')[0],
        channel: source || 'whatsapp',
        direction: 'in',
        message_preview: message.substring(0, 200),
      };
      if (!data.ob_history) data.ob_history = [];
      data.ob_history.push(histEntry);
      saveDb();

      engineLog('CADENCE_PAUSED', `Cadência pausada para ${ob.name} — lead respondeu`, ob.name);

      // LLM analysis (with offline fallback)
      try {
        if (!this._llmOffline) {
          const llm = require('./tools/llm');
          const analysis = await llm.analyzeMessage(message);
          if (analysis.needs_human) {
            this._triggerHIL(ob, analysis.objeção || 'Mensagem complexa requer atenção humana');
          }
          if (analysis.intenção === 'agendar_reuniao') {
            const lead = data.leads?.find(l => l.id === leadId);
            if (lead) {
      const resp = await fetch(`http://localhost:${process.env.PORT||3000}/api/calendly/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, lead_name: lead.name, lead_email: lead.email }),
        signal: AbortSignal.timeout(10000),
      });
              const data = await resp.json();
              if (data.success) {
                engineLog('AUTO_SCHEDULE', `Link Calendly gerado para ${ob.name}: ${data.scheduling_url}`, ob.name);
              }
            }
          }
          this._llmFailCount = 0;
          this._llmOffline = false;
        } else {
          // Offline: simple keyword-based intent detection
          const lower = message.toLowerCase();
          if (lower.includes('reuni') || lower.includes('agend') || lower.includes('call') || lower.includes('ligar')) {
            this._triggerHIL(ob, 'Lead quer agendar reunião (detecção offline)');
          } else if (lower.includes('preço') || lower.includes('valor') || lower.includes('custo') || lower.includes('quanto')) {
            this._triggerHIL(ob, 'Lead perguntando sobre preço (detecção offline)');
          }
        }
      } catch (e) {
        console.warn('[Engine] LLM indisponível:', e.message);
      }

      return { paused: true, obName: ob.name };
    }

    return { paused: false };
    });
  }

  // ── 7. HIL (Human-in-the-Loop) System (NEW) ──
  _triggerHIL(ob, reason) {
    loadDb();
    if (!data.hil_queue) data.hil_queue = [];
    const hilEntry = {
      id: dbm.genId(),
      ob_lead_id: ob.id,
      crm_lead_id: ob.crm_lead_id,
      lead_name: ob.name,
      company: ob.company,
      reason,
      status: 'pending',
      triggered_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      resolved_at: null,
    };
    data.hil_queue.push(hilEntry);
    saveDb();
    engineLog('HIL_TRIGGERED', `Ação humana necessária: ${ob.name} — ${reason}`, ob.name);
    this._pushLiveAction(`⚠️ HIL: ${ob.name} precisa de atenção humana — ${reason}`);
  }

  _processHILQueue() {
    loadDb();
    const hilQueue = data.hil_queue || [];
    const now = Date.now();
    let escalated = 0;
    for (const h of hilQueue) {
      if (h.status === 'pending' && h.expires_at && new Date(h.expires_at).getTime() <= now) {
        h.status = 'escalated';
        h.escalated_at = new Date().toISOString();
        h.escalation_note = 'Timeout de 24h excedido — escalado automaticamente';
        escalated++;
      }
    }
    if (escalated > 0) {
      saveDb();
      engineLog('HIL_ESCALATION', `${escalated} HILs escalados por timeout de 24h`);
    }
    const pending = hilQueue.filter(h => h.status === 'pending');
    if (pending.length > 0) {
      return `${pending.length} ações humanas pendentes`;
    }
    return null;
  }

  resolveHIL(hilId, resolution) {
    loadDb();
    const hil = (data.hil_queue || []).find(h => h.id === hilId);
    if (hil) {
      hil.status = resolution; // 'resolved', 'dismissed', 'escalated'
      hil.resolved_at = new Date().toISOString();
      saveDb();
      engineLog('HIL_RESOLVED', `HIL ${hilId} resolvido: ${resolution}`, hil.lead_name);
    }
  }

  // ── 8. Process Indicações Quentes (NEW) ──
  async _processIndicacoes(config) {
    loadDb();
    const indicacoes = data.indicacoes || [];
    const obLeads = data.ob_leads || [];
    const cadences = data.cadences || [];

    // Find new indicações not yet in outbound
    const activeCadence = cadences.find(c => c.status === 'Ativa');
    const newIndicacoes = indicacoes.filter(ind =>
      ind.status !== 'converted' &&
      ind.status !== 'contacted' &&
      !obLeads.find(ob => ob.indication_id === ind.id)
    );

    if (newIndicacoes.length === 0) return null;

    let processed = 0;
    for (const ind of newIndicacoes) {
      if (!ind.referred_name && !ind.referred_email && !ind.referred_phone) continue;

      // Create lead if not exists
      let lead = (data.leads || []).find(l => l.name === ind.referred_name && l.company === ind.referred_company);
      if (!lead) {
        lead = {
          id: dbm.genId(),
          name: ind.referred_name || 'Sem nome',
          company: ind.referred_company || '',
          email: ind.referred_email || '',
          phone: ind.referred_phone || '',
          job_title: ind.referred_job || '',
          main_pain: ind.message || '',
          source: 'indicacao',
          status: 'entrada_triagem',
          partner_id: '',
          value: 0,
          linkedin_url: '',
          last_stage_change: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        data.leads.push(lead);
      }

      // Create outbound entry with "Parceiro Afiado" approach
      const newOb = {
        id: dbm.genId(),
        crm_lead_id: lead.id,
        indication_id: ind.id,
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        job_title: lead.job_title,
        status: 'fila',
        last_contact: new Date().toISOString().split('T')[0],
        cadencia_step: 1,
        cadencia_id: activeCadence?.id || '',
        channel: lead.phone ? 'whatsapp' : 'email',
        paused: false,
        is_indication: true,
        created_at: new Date().toISOString(),
      };
      data.ob_leads.push(newOb);

      // Update indication status
      ind.status = 'contacted';
      ind.contact_started_at = new Date().toISOString();

      processed++;
      engineLog('INDICACAO_PROCESSADA', `${ind.referred_name} adicionado ao outbound com abordagem direta`, ind.referred_name);
      this._pushLiveAction(`🔥 Indicação quente: ${ind.referred_name} (${ind.referred_company}) — abordagem direta iniciada`);
    }

    if (processed > 0) {
      saveDb();
      return `${processed} indicações processadas`;
    }
    return null;
  }

  // ── 9. Geladeira Hygiene (NEW) ──
  _checkGeladeiraHygiene() {
    loadDb();
    const geladeira = data.geladeira || [];
    const untagged = geladeira.filter(g => !g.geladeira_tag);
    if (untagged.length > 0) {
      // Auto-tag old entries
      for (const g of untagged) {
        if (g.reason?.includes('bot')) g.geladeira_tag = '#Gelo_Bot_Loop';
        else if (g.reason?.includes('recus')) g.geladeira_tag = '#Gelo_Recusado';
        else if (g.reason?.includes('completa')) g.geladeira_tag = '#Gelo_Cadencia_Completa';
        else g.geladeira_tag = '#Gelo_Sem_Resposta';
      }
      saveDb();
      return `${untagged.length} leads na geladeira higienizados`;
    }
    return null;
  }

  // ── 10. Bot Re-evaluation (NEW) ──
  async _reEvaluateBotContacts() {
    loadDb();
    const obLeads = data.ob_leads || [];
    let reactivated = 0;

    for (const ob of obLeads) {
      if (ob.bot_freeze_until && new Date(ob.bot_freeze_until).getTime() <= Date.now()) {
        // Freeze expired — evaluate
        if (ob.bot_attempts >= 3) {
          // Persistent bot — move to geladeira
          this._moveToGeladeira(ob, 'Bot persistente após 3 tentativas de transbordo', '#Gelo_Bot_Loop');
          reactivated++;
        } else {
          // Temporary — resume
          ob.bot_freeze_until = null;
          ob.bot_attempts = 0;
          engineLog('BOT_RESUMED', `${ob.name} — congelamento expirado, retomando cadência`, ob.name);
        }
      }
    }

    if (reactivated > 0) {
      saveDb();
      return `${reactivated} contatos de bot movidos para geladeira`;
    }
    return null;
  }

  // ── 11. Generate Briefing Report (NEW) ──
  async _generateBriefing(leadId) {
    loadDb();
    const lead = (data.leads || []).find(l => l.id === leadId);
    if (!lead) return null;

    const history = (data.ob_history || []).filter(h => h.lead_id === leadId);
    const messages = history.map(h => h.message_preview || '').filter(Boolean).join('\n');

    try {
      if (!this._llmOffline) {
        const llm = require('./tools/llm');
        const prompt = `Gere um briefing comercial pré-call para o lead abaixo.

Empresa: ${lead.company || 'N/A'}
Segmento: ${lead.industry || 'N/A'}
Porte: ${lead.company_size || 'N/A'}
Faturamento/Capital: ${lead.value || 'N/A'}
Contato: ${lead.name} (${lead.job_title || 'N/A'})

Histórico de mensagens:
${messages.substring(0, 3000)}

Retorne JSON:
{
  "resumo_empresa": "breve resumo",
  "dor_principal": "principal necessidade identificada",
  "objecoes_levantadas": ["obj1", "obj2"],
  "como_contornadas": "resumo de como foram contornadas",
  "teto_estimado": "estimativa de faturamento/teto",
  "recomendacao_closer": "dica para o closer na call"
}`;

        const result = await llm.chat([
          { role: 'system', content: 'You are a sales briefing assistant. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ]);

        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const briefing = JSON.parse(jsonMatch[0]);
          lead.briefing_report = {
            ...briefing,
            generated_at: new Date().toISOString(),
            generated_by: 'Madalena AI',
          };
          saveDb();
          engineLog('BRIEFING_GERADO', `Briefing comercial gerado para ${lead.name}`, lead.name);
          this._llmFailCount = 0;
          this._llmOffline = false;
          return briefing;
        }
      } else {
        // Offline fallback: generate simple briefing from raw data
        const offlineBriefing = {
          resumo_empresa: `${lead.company || 'Empresa não informada'}${lead.industry ? ` - Segmento: ${lead.industry}` : ''}`,
          dor_principal: lead.main_pain || 'Não identificada (LLM offline)',
          objecoes_levantadas: [],
          como_contornadas: 'N/A',
          teto_estimado: lead.value ? `R$ ${Number(lead.value).toLocaleString('pt-BR')}` : 'Não informado',
          recomendacao_closer: `Contato: ${lead.name} (${lead.job_title || 'N/A'}). LLM offline — briefing limitado.`,
        };
        lead.briefing_report = {
          ...offlineBriefing,
          generated_at: new Date().toISOString(),
          generated_by: 'Madalena AI (modo offline)',
        };
        saveDb();
        engineLog('BRIEFING_GERADO', `Briefing offline gerado para ${lead.name}`, lead.name);
        return offlineBriefing;
      }
    } catch (e) {
      this._llmFailCount++;
      if (this._llmFailCount >= 3) {
        this._llmOffline = true;
      }
      console.warn('[Engine] Falha ao gerar briefing:', e.message);
    }
    return null;
  }

  // ── 12. Template rendering ──
  _renderTemplate(template, vars) {
    if (!template) return '';
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
    }
    return result;
  }
}

// ── Singleton ──
const engine = new AgentEngine();

// ── Direct execution ──
if (require.main === module) {
  engine.start().catch(console.error);
  process.on('SIGINT', async () => { await engine.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await engine.stop(); process.exit(0); });
}

module.exports = { engine, AgentEngine };
