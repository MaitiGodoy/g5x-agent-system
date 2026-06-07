/**
 * LLM Client — Doutor Antimatter Squad v4.7
 * 
 * Substitui completamente Groq/DeepSeek pelo Doutor via Python bridge.
 * O Doutor é a IA única do CRM G5X.
 * 
 * Arquitetura:
 *   Node.js (llm.js) → child_process → Python (doutor-bridge.py) → Doutor Kernel
 * 
 * Segurança:
 *   - Nenhuma chave de API exposta no Node.js
 *   - Doutor gerencia provedores, cotas, circuit breaker internamente
 *   - Timeout configurável em todas as chamadas
 */

const { execFile } = require('child_process');
const path = require('path');

// ── Config ──
const BRIDGE_SCRIPT = path.join(__dirname, 'doutor-bridge.py');
const PYTHON_CMD = process.env.DOUTOR_PYTHON || 'python';
const DEFAULT_TIMEOUT = 120000; // 120s (Ollama precisa de tempo p/ carregar modelo)
const BRIDGE_TIMEOUT = DEFAULT_TIMEOUT + 10000; // 10s extra for bridge overhead

// ── Circuit Breaker ──
const circuitState = {
  doutor: { failures: 0, lastFailure: 0, open: false },
};
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 min

function isCircuitOpen() {
  const state = circuitState.doutor;
  if (!state.open) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure() {
  const state = circuitState.doutor;
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    console.warn(`[Doutor] Circuit breaker OPEN (${state.failures} falhas consecutivas)`);
  }
}

function recordSuccess() {
  const state = circuitState.doutor;
  state.failures = 0;
  state.open = false;
}

// ── Bridge Call ──
function callDoutor(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (isCircuitOpen()) {
      return reject(new Error('Doutor circuit breaker aberto'));
    }

    const payload = JSON.stringify({ action, params });
    const child = execFile(
      PYTHON_CMD,
      [BRIDGE_SCRIPT, payload],
      {
        timeout: BRIDGE_TIMEOUT,
        maxBuffer: 1024 * 1024 * 5, // 5MB
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      },
      (error, stdout, stderr) => {
        if (error) {
          if (error.killed || error.signal === 'SIGTERM') {
            console.warn('[Doutor] Bridge timeout — processo encerrado');
          }
          recordFailure();
          return reject(error);
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.success === false) {
            recordFailure();
            return reject(new Error(result.error || 'Erro do Doutor'));
          }
          recordSuccess();
          resolve(result);
        } catch (parseErr) {
          recordFailure();
          console.error('[Doutor] Erro ao parsear resposta:', stdout.substring(0, 200));
          reject(new Error(`Resposta inválida do Doutor: ${parseErr.message}`));
        }
      }
    );
  });
}

// ── Public API ──

/**
 * Chat com histórico de mensagens (sistema + usuário + assistente).
 * Mantém compatibilidade com a interface anterior para não quebrar agent.js e api.js.
 */
async function chat(messages, timeoutMs = DEFAULT_TIMEOUT) {
  const result = await callDoutor('chat', { messages, timeout: timeoutMs });
  return result.content || '';
}

/**
 * Analisa intenção de uma mensagem de lead.
 * Retorna: { intenção, objeção, needs_human, tom, urgencia }
 */
async function analyzeMessage(message) {
  const result = await callDoutor('analyze', { message });
  return {
    intenção: result.intenção || 'desconhecida',
    objeção: result.objeção || null,
    needs_human: result.needs_human !== false,
    tom: result.tom || 'neutro',
    urgencia: result.urgencia || 'baixa',
  };
}

/**
 * Gera mensagem persuasiva baseada em contexto do lead.
 */
async function generateMessage(context) {
  const result = await callDoutor('generate', { context });
  return result.content || 'Erro ao gerar mensagem.';
}

/**
 * Quebra de objeção usando base de conhecimento.
 */
async function handleObjection(objection, knowledgeBase) {
  const result = await callDoutor('objection', { objection, knowledge: knowledgeBase });
  return result.content || 'Não foi possível processar esta objeção no momento.';
}

/**
 * Gera insights de performance do CRM.
 */
async function generateInsights(data) {
  const result = await callDoutor('insights', { data });
  return result.content || 'Não foi possível gerar insights no momento.';
}

/**
 * Testa conexão com o Doutor.
 * Retorna: { doutor: { status, providers, circuit_breaker } }
 */
async function testConnection() {
  try {
    const result = await callDoutor('test');
    return {
      doutor: {
        status: result.status === 'connected' ? 'ok' : 'error',
        providers: result.providers || 0,
        circuit_breaker: result.circuit_breaker || {},
      }
    };
  } catch (e) {
    return { doutor: { status: 'error', message: e.message } };
  }
}

/**
 * Classificação de lead (ICP scoring).
 * Retorna: { score, classificacao, justificativa, confianca, recomendacao }
 */
async function scoreLead(leadData) {
  const result = await callDoutor('score', { lead: leadData });
  return {
    score: result.score || 0,
    classificacao: result.classificacao || 'Desconhecido',
    justificativa: result.justificativa || '',
    confianca: result.confianca || 0,
    recomendacao: result.recomendacao || '',
  };
}

module.exports = {
  chat,
  analyzeMessage,
  generateMessage,
  handleObjection,
  generateInsights,
  testConnection,
  testGroq: testConnection, // compatibilidade com código legado
  testDeepSeek: testConnection, // compatibilidade com código legado
  scoreLead,
  circuitState,
};
