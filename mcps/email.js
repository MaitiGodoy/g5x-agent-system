require('dotenv').config();
const express = require('express');
const app = express();
const port = 3002;

app.use(express.json());

// ── SMTP Transport (nodemailer) ──
let transporter = null;
async function getTransport() {
  if (transporter) return transporter;
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    await transporter.verify();
    console.log('[Email] SMTP conectado:', process.env.SMTP_EMAIL);
    return transporter;
  } catch (e) {
    console.warn('[Email] SMTP não configurado ou erro:', e.message);
    return null;
  }
}

// ── Template Engine (simples) ──
const TEMPLATES_DIR = process.env.EMAIL_TEMPLATES_DIR || './email-templates';
function renderTemplate(templateName, vars = {}) {
  try {
    const fs = require('fs');
    const path = require('path');
    let template = fs.readFileSync(path.join(TEMPLATES_DIR, `${templateName}.html`), 'utf8');
    for (const [key, val] of Object.entries(vars)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }
    return template;
  } catch (e) {
    console.warn('[Email] Template não encontrado:', templateName, e.message);
    return null;
  }
}

// ── Health ──
app.get('/health', (req, res) => {
  res.json({
    status: 'MCP Email ativo',
    configured: !!process.env.SMTP_EMAIL,
    smtp_connected: transporter !== null,
    templates_dir: TEMPLATES_DIR,
  });
});

async function sendSingleEmail({ to, subject, message, template, vars, cc, bcc, attachments }) {
  if (!to || !subject) {
    return { success: false, error: 'Destinatário (to) e assunto (subject) são obrigatórios' };
  }

  let html = message;
  if (template) {
    const rendered = renderTemplate(template, { ...vars, to, subject });
    if (rendered) html = rendered;
  }

  const transport = await getTransport();
  if (!transport) {
    console.log(`[Email][SIMULADO] Para: ${to} | Assunto: ${subject}`);
    return { success: true, simulated: true, to, subject };
  }

  try {
    const info = await transport.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'G5X'}" <${process.env.SMTP_EMAIL}>`,
      to, cc, bcc,
      subject,
      html: html || message,
      attachments: attachments || [],
    });
    console.log(`[Email] Enviado para ${to} | ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId, to, subject };
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Send Email ──
app.post('/send', async (req, res) => {
  const result = await sendSingleEmail(req.body);
  if (result.success) return res.json(result);
  res.status(500).json(result);
});

// ── Send Bulk (cadência) ──
app.post('/send-bulk', async (req, res) => {
  const { recipients, subject, template, vars } = req.body;
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Lista de destinatários é obrigatória' });
  }

  const results = [];
  for (const r of recipients) {
    const data = await sendSingleEmail({
      to: r.email,
      subject,
      template,
      vars: { ...vars, ...r.vars, nome: r.name },
    });
    results.push({ email: r.email, status: data.success ? 'enviado' : 'erro', error: data.error });
  }

  console.log(`[Email] Bulk: ${results.filter(r=>r.status==='enviado').length}/${recipients.length} enviados`);
  res.json({ success: true, results });
});

app.listen(port, () => {
  console.log(`[MCP] Servidor Email rodando na porta ${port}`);
});
