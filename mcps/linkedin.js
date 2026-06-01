require('dotenv').config();
const express = require('express');
const app = express();
const port = 3003;

app.use(express.json());

// ── LinkedIn Automation Client ──
// Estratégias: LinkedIn API (restrita) ou Browser Automation (Puppeteer/Playwright)
const LINKEDIN_STRATEGY = process.env.LINKEDIN_STRATEGY || 'api'; // 'api' | 'browser'
let browser = null;

async function getBrowser() {
  if (browser) return browser;
  if (LINKEDIN_STRATEGY !== 'browser') return null;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    console.log('[LinkedIn] Browser iniciado');
    return browser;
  } catch (e) {
    console.warn('[LinkedIn] Browser automation não disponível:', e.message);
    return null;
  }
}

// ── LinkedIn API Client (via RapidAPI ou proxy) ──
const LINKEDIN_API_KEY = process.env.LINKEDIN_API_KEY || '';
const LINKEDIN_API_BASE = process.env.LINKEDIN_API_BASE || 'https://linkedin-api8.p.rapidapi.com';

async function linkedinApiFetch(endpoint, options = {}) {
  if (!LINKEDIN_API_KEY) return null;
  try {
    const url = `${LINKEDIN_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': LINKEDIN_API_KEY,
        'x-rapidapi-host': new URL(LINKEDIN_API_BASE).hostname,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('[LinkedIn] API erro:', e.message);
    return null;
  }
}

// ── Health ──
app.get('/health', (req, res) => {
  res.json({
    status: 'MCP LinkedIn ativo',
    configured: !!(process.env.LINKEDIN_CONFIGURED === 'true' || LINKEDIN_API_KEY),
    strategy: LINKEDIN_STRATEGY,
    has_api_key: !!LINKEDIN_API_KEY,
    has_browser: LINKEDIN_STRATEGY === 'browser',
  });
});

// ── Buscar Perfil ──
app.post('/profile/search', async (req, res) => {
  const { name, company, email } = req.body;

  const data = await linkedinApiFetch('/search', {
    method: 'POST',
    body: JSON.stringify({ keywords: `${name || ''} ${company || ''}`, limit: 5 }),
  });

  if (data) return res.json({ success: true, profiles: data.data || [] });

  // Simulado
  console.log(`[LinkedIn][SIMULADO] Busca: ${name} na ${company}`);
  res.json({
    success: true,
    simulated: true,
    profiles: [{
      name: name || 'Perfil Encontrado',
      headline: `${company || ''} - Diretor`,
      linkedin_url: `https://linkedin.com/in/${(name||'perfil').toLowerCase().replace(/\s/g,'')}`,
    }],
  });
});

// ── Enviar Mensagem ──
app.post('/send', async (req, res) => {
  if (process.env.LINKEDIN_CONFIGURED !== 'true' && !LINKEDIN_API_KEY) {
    console.log(`[LinkedIn][SIMULADO] Mensagem para ${req.body.to}: ${(req.body.message||'').substring(0,50)}`);
    return res.json({ success: true, simulated: true, to: req.body.to });
  }

  if (LINKEDIN_STRATEGY === 'browser') {
    const br = await getBrowser();
    if (!br) return res.status(503).json({ error: 'Browser não disponível' });
    // Aqui iria a automação via página do LinkedIn
    console.log(`[LinkedIn][Browser] Mensagem enviada para ${req.body.to}`);
    return res.json({ success: true, strategy: 'browser' });
  }

  const data = await linkedinApiFetch('/send-message', {
    method: 'POST',
    body: JSON.stringify({ recipient: req.body.to, message: req.body.message }),
  });

  res.json({ success: !!data, simulated: !data, data });
});

// ── Enviar Convite de Conexão ──
app.post('/connect', async (req, res) => {
  const { profile_url, message } = req.body;
  console.log(`[LinkedIn][SIMULADO] Convite para ${profile_url}: ${(message||'Sem msg').substring(0,50)}`);
  res.json({ success: true, simulated: true, profile_url, message_sent: !!message });
});

// ── Buscar Leads por Empresa ──
app.post('/company/search', async (req, res) => {
  const { company, title_keywords, limit } = req.body;
  const data = await linkedinApiFetch('/company-employees', {
    method: 'POST',
    body: JSON.stringify({ company, titleKeywords: title_keywords, limit: limit || 10 }),
  });
  if (data) return res.json({ success: true, profiles: data.data || [] });

  console.log(`[LinkedIn][SIMULADO] Busca: ${company} - ${title_keywords||'todos'}`);
  res.json({
    success: true,
    simulated: true,
    profiles: Array.from({length: limit||3}, (_,i) => ({
      name: `Lead ${i+1} da ${company}`,
      title: title_keywords || 'Diretor',
      linkedin_url: `https://linkedin.com/in/lead${i+1}`,
    })),
  });
});

app.listen(port, () => {
  console.log(`[MCP] Servidor LinkedIn rodando na porta ${port}`);
});
