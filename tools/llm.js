require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');

// ── API Key Validation ──
const groqKey = process.env.GROQ_API_KEY;
const deepseekKey = process.env.DEEPSEEK_API_KEY;

const groqValid = groqKey && groqKey !== 'test' && groqKey.length > 10;
const deepseekValid = deepseekKey && deepseekKey !== 'test' && deepseekKey.length > 10;

let groqClient = null;
let deepseekClient = null;

if (groqValid) {
  groqClient = new OpenAI({
    apiKey: groqKey,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 30000,
    maxRetries: 2,
  });
  console.log('[LLM] ✅ Groq configurada');
} else {
  console.log('[LLM] ⚠️ Groq NÃO configurada (key ausente ou inválida)');
}

if (deepseekValid) {
  deepseekClient = new OpenAI({
    apiKey: deepseekKey,
    baseURL: 'https://api.deepseek.com',
    timeout: 60000,
    maxRetries: 1,
  });
  console.log('[LLM] ✅ DeepSeek configurada');
} else {
  console.log('[LLM] ⚠️ DeepSeek NÃO configurada (key ausente ou inválida)');
}

// ── Circuit Breaker State ──
const circuitState = {
  groq: { failures: 0, lastFailure: 0, open: false },
  deepseek: { failures: 0, lastFailure: 0, open: false },
};
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 min

function isCircuitOpen(provider) {
  const state = circuitState[provider];
  if (!state.open) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(provider) {
  const state = circuitState[provider];
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    console.warn(`[LLM] Circuit breaker OPEN para ${provider} (${state.failures} falhas consecutivas)`);
  }
}

function recordSuccess(provider) {
  const state = circuitState[provider];
  state.failures = 0;
  state.open = false;
}

// ── Observabilidade ──
function logAnalytics(task, model, durationMs) {
  const logEntry = `[${new Date().toISOString()}] Tarefa: ${task} | Modelo: ${model} | Tempo: ${durationMs}ms\n`;
  console.log(`[Analytics] ${logEntry.trim()}`);
  try { fs.appendFileSync('agent_analytics.log', logEntry); } catch(e) {}
}

// ── Modelos ──
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
const DEEPSEEK_MODEL = 'deepseek-chat';

// ── Test Connection ──
async function testConnection() {
  const results = { groq: null, deepseek: null };

  if (groqClient) {
    try {
      const start = Date.now();
      await groqClient.chat.completions.create({
        model: GROQ_MODELS[0],
        messages: [{ role: 'user', content: 'ok' }],
        max_tokens: 5,
      });
      results.groq = { status: 'ok', latency_ms: Date.now() - start };
      recordSuccess('groq');
    } catch (e) {
      results.groq = { status: 'error', message: e.message?.substring(0, 100) };
      recordFailure('groq');
    }
  } else {
    results.groq = { status: 'not_configured' };
  }

  if (deepseekClient) {
    try {
      const start = Date.now();
      await deepseekClient.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: 'ok' }],
        max_tokens: 5,
      });
      results.deepseek = { status: 'ok', latency_ms: Date.now() - start };
      recordSuccess('deepseek');
    } catch (e) {
      results.deepseek = { status: 'error', message: e.message?.substring(0, 100) };
      recordFailure('deepseek');
    }
  } else {
    results.deepseek = { status: 'not_configured' };
  }

  return results;
}

// ── Router Inteligente com FALLBACK em cascata ──
async function rotearTarefa(prompt, complexidade, isJson = false) {
  const isSimples = ["simples", "tool_call", "parse", "crm_update"].includes(complexidade);

  // Tentar Groq primeiro
  if (groqClient && !isCircuitOpen('groq')) {
    for (const model of GROQ_MODELS) {
      try {
        const config = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
        };
        if (isJson) config.response_format = { type: 'json_object' };

        const startTime = Date.now();
        const response = await groqClient.chat.completions.create(config);
        logAnalytics(complexidade, model, Date.now() - startTime);
        recordSuccess('groq');
        return response.choices[0].message.content;
      } catch (error) {
        console.warn(`[Router] Groq ${model} falhou: ${error.message?.substring(0, 100)}`);
        recordFailure('groq');
        continue;
      }
    }
  } else if (isCircuitOpen('groq')) {
    console.warn('[Router] Groq circuit breaker aberto, pulando para DeepSeek');
  }

  // Fallback DeepSeek
  if (deepseekClient && !isCircuitOpen('deepseek')) {
    try {
      const config = {
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
      };
      if (isJson) config.response_format = { type: 'json_object' };

      const startTime = Date.now();
      const response = await deepseekClient.chat.completions.create(config);
      logAnalytics(`${complexidade} (DeepSeek)`, DEEPSEEK_MODEL, Date.now() - startTime);
      recordSuccess('deepseek');
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`[Router] DeepSeek também falhou: ${error.message?.substring(0, 100)}`);
      recordFailure('deepseek');
    }
  } else if (isCircuitOpen('deepseek')) {
    console.warn('[Router] DeepSeek circuit breaker aberto');
  }

  throw new Error(`Todas as APIs falharam. Groq: ${circuitState.groq.open ? 'circuit open' : 'modelos indisponíveis'}. DeepSeek: ${circuitState.deepseek.open ? 'circuit open' : 'indisponível'}.`);
}

// ── Chat com histórico de mensagens ──
async function chat(messages) {
  // Tentar DeepSeek primeiro (Cérebro da operação que fala com o cliente)
  if (deepseekClient && !isCircuitOpen('deepseek')) {
    try {
      const response = await deepseekClient.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: messages,
      });
      console.log('[Chat] Resposta via DeepSeek (Cérebro)');
      recordSuccess('deepseek');
      return response.choices[0].message.content;
    } catch (error) {
      console.error('[Chat] DeepSeek falhou, tentando fallback para Groq:', error.message);
      recordFailure('deepseek');
    }
  } else if (isCircuitOpen('deepseek')) {
    console.warn('[Chat] DeepSeek circuit breaker aberto, tentando fallback para Groq');
  }

  // Fallback Groq (Braços da operação)
  if (groqClient && !isCircuitOpen('groq')) {
    for (const model of GROQ_MODELS) {
      try {
        const response = await groqClient.chat.completions.create({
          model: model,
          messages: messages,
        });
        console.log(`[Chat] Resposta via Groq ${model} (Fallback)`);
        recordSuccess('groq');
        return response.choices[0].message.content;
      } catch (error) {
        console.warn(`[Chat] Groq ${model} falhou: ${error.message?.substring(0, 80)}`);
        recordFailure('groq');
        continue;
      }
    }
  } else if (isCircuitOpen('groq')) {
    console.warn('[Chat] Groq circuit breaker aberto');
  }

  throw new Error(`Nenhuma API disponível. DeepSeek: ${deepseekClient ? (circuitState.deepseek.open ? 'circuit open' : 'falhou') : 'não configurada'}. Groq: ${groqClient ? (circuitState.groq.open ? 'circuit open' : 'falhou') : 'não configurada'}.`);
}

async function analyzeMessage(message) {
  const prompt = `Analise a seguinte mensagem do lead e retorne um JSON com a intenção (ex: "agendar_reuniao", "duvida", "objecao", "desinteresse"), a objeção (se houver), e um booleano "needs_human" caso a dúvida seja técnica demais ou sensível.\nMensagem: "${message}"`;

  try {
    const res = await rotearTarefa(prompt, "parse", true);
    return JSON.parse(res);
  } catch (error) {
    return { intenção: 'desconhecida', objeção: null, needs_human: true };
  }
}

async function generateMessage(context) {
  const prompt = `Gere uma mensagem persuasiva baseada no seguinte contexto do lead:\n${JSON.stringify(context, null, 2)}`;
  try {
    return await rotearTarefa(prompt, "personalizacao");
  } catch (error) {
    return "Erro ao gerar mensagem. Tente novamente mais tarde.";
  }
}

async function handleObjection(objection, knowledgeBase) {
  const prompt = `Um lead apresentou a seguinte objeção: "${objection}".\nUsando a base de conhecimento a seguir, elabore uma resposta adequada para contornar a objeção:\n${knowledgeBase}`;
  try {
    return await rotearTarefa(prompt, "objecao");
  } catch (error) {
    return "Infelizmente não consegui encontrar uma resposta para essa objeção no momento.";
  }
}

async function generateInsights(data) {
  const prompt = `Analise os seguintes dados do CRM e retorne 3 insights curtos e diretos sobre a performance da equipe:\n${JSON.stringify(data, null, 2)}`;
  try {
    return await rotearTarefa(prompt, "crm_update");
  } catch (error) {
    return "Não foi possível gerar insights no momento.";
  }
}

module.exports = {
  chat,
  analyzeMessage,
  generateMessage,
  handleObjection,
  generateInsights,
  testConnection,
  circuitState,
};
