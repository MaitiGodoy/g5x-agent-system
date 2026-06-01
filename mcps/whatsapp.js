require('dotenv').config();
const express = require('express');
const app = express();
const port = 3001;

app.use(express.json({ limit: '10mb' }));

// ── Evolution API Client ──
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'g5x';
const CONFIGURED = process.env.WHATSAPP_CONFIGURED === 'true';

function evolutionHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY,
  };
}

async function evolutionFetch(endpoint, options = {}) {
  if (!CONFIGURED || !EVOLUTION_API_KEY) return null;
  try {
    const url = `${EVOLUTION_API_URL}/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...evolutionHeaders(), ...options.headers },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.warn(`[WhatsApp][API] HTTP ${response.status} em ${endpoint}`);
      const text = await response.text();
      console.warn('[WhatsApp][API] Resposta:', text.substring(0, 200));
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`[WhatsApp][API] Erro em ${endpoint}: ${err.message}`);
    return null;
  }
}

// ── Health ──
app.get('/health', (req, res) => {
  res.json({
    status: 'MCP WhatsApp ativo',
    configured: CONFIGURED,
    evolution_url: EVOLUTION_API_URL,
    instance: EVOLUTION_INSTANCE,
    has_api_key: !!EVOLUTION_API_KEY,
  });
});

// ── Send Message via Evolution API ──
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Destinatário (to) e mensagem (message) são obrigatórios' });
  }

  const normalizedPhone = to.replace(/[^0-9]/g, '');
  if (normalizedPhone.length < 10) {
    return res.status(400).json({ error: 'Número de telefone inválido' });
  }

  if (!CONFIGURED) {
    console.log(`[WhatsApp][SIMULADO] Para: ${normalizedPhone} | Msg: ${message.substring(0, 80)}...`);
    return res.json({ success: true, simulated: true, to: normalizedPhone });
  }

  // Tenta Evolution API
  const result = await evolutionFetch(`message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: normalizedPhone,
      text: message,
      delay: 1000,
    }),
  });

  if (result) {
    console.log(`[WhatsApp] Enviado para ${normalizedPhone} | ID: ${result.key?.id || 'N/A'}`);
    return res.json({
      success: true,
      messageId: result.key?.id,
      to: normalizedPhone,
      evolution: true,
    });
  }

  // Fallback: simulated
  console.log(`[WhatsApp][SIMULADO] Para: ${normalizedPhone} (Evolution offline)`);
  res.json({ success: true, simulated: true, to: normalizedPhone });
});

// ── Send Template Message (para mensagens com botões) ──
app.post('/send-template', async (req, res) => {
  const { to, templateName, templateParams } = req.body;

  if (!CONFIGURED) {
    return res.json({ success: true, simulated: true, to });
  }

  const result = await evolutionFetch(`message/sendTemplate/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: to.replace(/[^0-9]/g, ''),
      template: { name: templateName, params: templateParams },
    }),
  });

  if (result) {
    res.json({ success: true, messageId: result.key?.id, evolution: true });
  } else {
    res.json({ success: true, simulated: true, to });
  }
});

// ── Check Instance Connection ──
app.get('/instance/status', async (req, res) => {
  if (!CONFIGURED) {
    return res.json({ connected: false, simulated: true, message: 'WhatsApp não configurado' });
  }

  const result = await evolutionFetch(`instance/connectionState/${EVOLUTION_INSTANCE}`);
  if (result) {
    res.json({ connected: result.state === 'open', state: result.state, instance: EVOLUTION_INSTANCE });
  } else {
    res.json({ connected: false, error: 'Não foi possível verificar conexão' });
  }
});

// ── Generate QR Code (para conectar nova instância) ──
app.get('/instance/qrcode', async (req, res) => {
  if (!CONFIGURED) {
    return res.json({ qrcode: null, simulated: true, message: 'WhatsApp não configurado' });
  }

  const result = await evolutionFetch(`instance/qrcode/${EVOLUTION_INSTANCE}`);
  if (result && result.qrcode) {
    res.json({ qrcode: result.qrcode, instance: EVOLUTION_INSTANCE });
  } else {
    res.json({ qrcode: null, error: 'QR Code não disponível' });
  }
});

// ── Webhook para receber mensagens ──
app.post('/webhook/incoming', (req, res) => {
  const event = req.body;
  console.log('[WhatsApp][Webhook] Evento recebido:', JSON.stringify(event).substring(0, 300));

  // Encaminha para o server.js principal
  if (event.data?.message?.fromMe === false) {
    const sender = event.data?.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const messageText = event.data?.message?.conversation ||
      event.data?.message?.extendedTextMessage?.text ||
      '';
    const leadId = `whatsapp:${sender}`;

    fetch(`http://localhost:${process.env.SERVER_PORT || 3000}/webhook/incoming`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, message: messageText, source: 'whatsapp' }),
    }).catch(err => console.warn('[WhatsApp] Erro ao encaminhar webhook:', err.message));
  }

  res.json({ received: true });
});

app.listen(port, () => {
  console.log(`[MCP] Servidor WhatsApp rodando na porta ${port}`);
  if (!CONFIGURED) {
    console.log('[MCP] WhatsApp em MODO SIMULADO — configure EVOLUTION_API_KEY e WHATSAPP_CONFIGURED=true para ativar');
  }
});
