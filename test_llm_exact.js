/**
 * Test that exactly replicates what api.js does.
 */
const { execFile } = require('child_process');
const path = require('path');

const BRIDGE_SCRIPT = '/app/tools/doutor-bridge.py';
const PYTHON_CMD = 'python3';

// Replicate what api.js line 637-643 does
const systemPrompt = `Você é Madalena — Arquiteta de Pipeline Unificado e Roteamento G5X.
Você é o Motor de Raciocínio de CRM da G5X.
REGRAS DE ORIGEM:
| Origem | Ação |
|--------|------|
| Intec (Frio) | Cadência de 10 Toques (5 E-mails + 5 WhatsApps) |
| Indicação (Quente) | Bloquear automações. Abordagem Direta com Autoridade Emprestada |`;

const chatHistory = [];
const message = "Ola, quem e voce?";

const messages = [
  { role: 'system', content: systemPrompt },
  ...chatHistory.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content })),
  { role: 'user', content: message }
];

const payload = JSON.stringify({
  action: 'chat',
  params: { messages, timeout: 30000 }
});

console.log('Payload length:', payload.length);

execFile(
  PYTHON_CMD,
  [BRIDGE_SCRIPT, payload],
  {
    timeout: 35000,
    maxBuffer: 1024 * 1024 * 5,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  },
  (error, stdout, stderr) => {
    if (error) {
      console.log('Error:', error.message);
      if (stderr) console.log('Stderr:', stderr);
    }
    if (stdout) console.log('Stdout:', stdout);
  }
);
