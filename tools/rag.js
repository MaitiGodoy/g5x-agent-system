// Módulo RAG — Busca por Relevância em Documentos Uploadados
// Usa keyword scoring (BM25 simplificado) sobre chunks dos documentos

const fs = require('fs');
const path = require('path');

// ── Config ──
const DATA_DIR = (process.env.DATA_DIR && require('fs').existsSync(process.env.DATA_DIR)) ? process.env.DATA_DIR : path.join(__dirname, '..');
const dbFile = path.join(DATA_DIR, 'crm-db.json');

function readDb() {
  try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); }
  catch { return {}; }
}

// ── Tokenização e Normalização ──
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\sà-ú]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// ── Stopwords Português ──
const STOPWORDS = new Set([
  'para', 'com', 'sem', 'uma', 'das', 'dos', 'que', 'mais', 'muito', 'sua', 'seu',
  'ele', 'ela', 'eles', 'elas', 'isso', 'isto', 'esse', 'essa', 'este', 'esta',
  'não', 'sim', 'como', 'quando', 'onde', 'qual', 'quais', 'pelo', 'pela', 'pelos',
  'pelas', 'num', 'numa', 'nos', 'nas', 'dele', 'dela', 'deles', 'delas', 'entre',
  'sobre', 'após', 'ante', 'desde', 'durante', 'mediante', 'segundo', 'conforme',
  'através', 'perante', 'também', 'ainda', 'apenas', 'somente', 'todo', 'toda',
  'todos', 'todas', 'outro', 'outra', 'outros', 'outras', 'mesmo', 'mesma',
  'primeiro', 'segundo', 'terceiro', 'cada', 'sempre', 'nunca', 'já', 'ainda',
  'agora', 'depois', 'antes', 'hoje', 'amanhã', 'ontem', 'aqui', 'ali', 'lá',
  'cá', 'aqui', 'este', 'esse', 'aquele', 'esta', 'essa', 'aquela', 'isto', 'isso',
  'aquilo', 'nosso', 'nossa', 'nossos', 'nossas', 'seu', 'sua', 'seus', 'suas',
  'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'um', 'dois',
  'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'por', 'em',
  'de', 'no', 'na', 'ao', 'aos', 'às', 'da', 'do', 'das', 'dos', 'se', 'o', 'a',
  'os', 'as', 'e', 'ou', 'mas', 'porque', 'pois', 'então', 'logo', 'assim',
]);

function removeStopwords(tokens) {
  return tokens.filter(t => !STOPWORDS.has(t));
}

// ── BM25 Simplificado ──
function bm25Score(queryTokens, docTokens, k1 = 1.5, b = 0.75) {
  const docLen = docTokens.length;
  const avgDocLen = Math.max(docLen, 50); // fallback
  let score = 0;

  for (const qt of queryTokens) {
    let tf = 0;
    for (const dt of docTokens) {
      if (dt === qt) tf++;
    }
    if (tf === 0) continue;

    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
    score += numerator / denominator;
  }

  return score;
}

// ── Buscar contexto relevante nos documentos uploadados ──
async function findRelevantContext(query, topK = 3) {
  console.log(`[RAG] Buscando contexto para: "${query.substring(0, 80)}..."`);

  const db = readDb();
  const docs = db.knowledge_docs || [];

  if (docs.length === 0) {
    console.log('[RAG] Nenhum documento encontrado na base de conhecimento');
    return null;
  }

  const queryTokens = removeStopwords(tokenize(query));
  if (queryTokens.length === 0) {
    console.log('[RAG] Query vazia após remover stopwords');
    return null;
  }

  const scored = [];

  for (const doc of docs) {
    const chunks = doc.chunks || [doc.text || ''];
    const filename = doc.filename || 'documento';

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk || chunk.trim().length === 0) continue;

      const docTokens = removeStopwords(tokenize(chunk));
      const score = bm25Score(queryTokens, docTokens);

      if (score > 0) {
        scored.push({
          score,
          content: chunk,
          filename,
          chunk_index: i,
        });
      }
    }
  }

  // Ordenar por score e pegar top K
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  if (top.length === 0) {
    console.log('[RAG] Nenhum chunk relevante encontrado');
    return null;
  }

  console.log(`[RAG] Encontrados ${top.length} chunks relevantes (melhor score: ${top[0].score.toFixed(2)})`);

  return top.map(t => ({
    content: t.content,
    source: t.filename,
    score: t.score,
  }));
}

// ── Buscar direto como string (compatibilidade com versão anterior) ──
async function findRelevantContextString(query, topK = 3) {
  const results = await findRelevantContext(query, topK);
  if (!results || results.length === 0) return null;
  return results.map(r => `[${r.source}] ${r.content}`).join('\n\n---\n\n');
}

// ── Ingest de documento (para uso programático) ──
function ingestDocument(text, metadata = {}) {
  const CHUNK_SIZE = 2000;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.substring(i, i + CHUNK_SIZE));
  }

  return {
    id: metadata.id || Date.now().toString(),
    filename: metadata.filename || 'documento.txt',
    text: text.substring(0, 50000),
    chunks,
    uploaded_at: metadata.uploaded_at || new Date().toISOString(),
  };
}

// ── Mock fallback (compatibilidade) ──
const mockKnowledgeBase = [
  { topic: "preco", content: "Nosso serviço custa R$ 1000/mês, mas o ROI médio é de 5x o valor investido logo no primeiro mês." },
  { topic: "concorrente", content: "Nosso diferencial em relação à concorrência é a nossa inteligência artificial proprietária e o suporte 24/7." },
  { topic: "tempo", content: "O tempo de implantação é de apenas 48 horas." }
];

async function findRelevantContextMock(query) {
  const real = await findRelevantContext(query);
  if (real) return real.map(r => r.content).join(' ');

  // Fallback para mock
  const queryLower = query.toLowerCase();
  for (const doc of mockKnowledgeBase) {
    if (queryLower.includes(doc.topic)) {
      return doc.content;
    }
  }
  return "Temos as melhores soluções do mercado adaptadas para o seu negócio. Fale com nosso suporte para mais detalhes.";
}

module.exports = {
  findRelevantContext,
  findRelevantContextString,
  findRelevantContextMock,
  ingestDocument,
  tokenize,
  bm25Score,
};
