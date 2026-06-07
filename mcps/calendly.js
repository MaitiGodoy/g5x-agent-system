require('dotenv').config();
const express = require('express');
const app = express();
const port = 3004;

app.use(express.json());

// ── Calendly API Client ──
const CALENDLY_API_BASE = 'https://api.calendly.com';
const CALENDLY_TOKEN = process.env.CALENDLY_TOKEN || '';

async function calendlyFetch(endpoint, options = {}) {
  if (!CALENDLY_TOKEN) {
    console.warn('[Calendly] Token não configurado. Usando modo simulado.');
    return null;
  }
  try {
    const url = `${CALENDLY_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CALENDLY_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) {
      console.warn(`[Calendly] HTTP ${response.status} em ${endpoint}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('[Calendly] Erro de conexão:', err.message);
    return null;
  }
}

// ── Health ──
app.get('/health', (req, res) => {
  res.json({
    status: 'MCP Calendly ativo',
    configured: !!CALENDLY_TOKEN,
    user_uri: process.env.CALENDLY_USER_URI || null,
  });
});

// ── Listar Event Types ──
app.get('/event-types', async (req, res) => {
  const data = await calendlyFetch(`/event_types?user=${process.env.CALENDLY_USER_URI || ''}`);
  if (data) {
    res.json({ success: true, event_types: data.collection || [] });
  } else {
    // Modo simulado
    res.json({
      success: true,
      simulated: true,
      event_types: [
        { uri: 'https://api.calendly.com/event_types/abc123', name: 'Diagnóstico 15min', duration: 15, active: true },
        { uri: 'https://api.calendly.com/event_types/def456', name: 'Apresentação de Teto', duration: 30, active: true },
      ],
    });
  }
});

// ── Criar Scheduling Link ──
app.post('/scheduling-links', async (req, res) => {
  const { event_type_uri, lead_name, lead_email, owner_uri, min_time, max_time } = req.body;

  if (!event_type_uri || !CALENDLY_TOKEN) {
    // Modo simulado: retorna link fake
    const fakeLink = `https://calendly.com/g5x/diagnostico?name=${encodeURIComponent(lead_name || 'Lead')}&email=${encodeURIComponent(lead_email || '')}`;
    console.log(`[Calendly][SIMULADO] Link gerado para ${lead_name}: ${fakeLink}`);
    return res.json({
      success: true,
      simulated: true,
      scheduling_url: fakeLink,
      event_type: event_type_uri || 'diagnostico_15min',
      invitee: { name: lead_name, email: lead_email },
    });
  }

  const data = await calendlyFetch('/scheduling_links', {
    method: 'POST',
    body: JSON.stringify({
      max_event_count: 1,
      owner: owner_uri || process.env.CALENDLY_USER_URI,
      owner_type: 'EventType',
    }),
  });

  if (data) {
    res.json({ success: true, scheduling_url: data.resource?.booking_url, resource: data.resource });
  } else {
    res.json({ success: true, simulated: true, scheduling_url: `https://calendly.com/g5x/diagnostico?name=${encodeURIComponent(lead_name || '')}` });
  }
});

// ── Verificar Disponibilidade ──
app.post('/availability', async (req, res) => {
  const { event_type_uri, start_time, end_time } = req.body;
  const data = await calendlyFetch('/availability', {
    method: 'POST',
    body: JSON.stringify({
      event_type: event_type_uri,
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + 7 * 86400000).toISOString(),
    }),
  });

  if (data) {
    res.json({ success: true, slots: data.collection || [] });
  } else {
    // Simulado: slots genéricos
    const slots = [];
    const now = new Date();
    for (let d = 1; d <= 5; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      day.setHours(9, 0, 0, 0);
      for (let h = 0; h < 8; h++) {
        slots.push({
          start_time: new Date(day.getTime() + h * 3600000).toISOString(),
          end_time: new Date(day.getTime() + (h + 1) * 3600000).toISOString(),
          available: true,
        });
      }
    }
    res.json({ success: true, simulated: true, slots });
  }
});

// ── Webhook: Evento Criado ──
app.post('/webhook/event-created', (req, res) => {
  const event = req.body;
  console.log('[Calendly] Webhook: evento criado', JSON.stringify(event).substring(0, 300));
  // Aqui o sistema pode marcar o lead como "Diagnóstico Agendado" automaticamente
  res.json({ received: true });
});

// ── Health do Closer (disponibilidade manual) ──
app.get('/closer-availability', (req, res) => {
  // O closer define horários via painel ou JSON estático
  const availability = process.env.CLOSER_AVAILABILITY
    ? JSON.parse(process.env.CLOSER_AVAILABILITY)
    : { weekdays: ['seg', 'ter', 'qua', 'qui', 'sex'], hours: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], timezone: 'America/Sao_Paulo' };
  res.json(availability);
});

app.listen(port, () => {
  console.log(`[MCP] Servidor Calendly rodando na porta ${port}`);
});
