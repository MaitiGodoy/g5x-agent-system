const { Queue, Worker } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
};

// Lazy init — só cria a Queue quando realmente precisar
// Evita crash se Redis não estiver rodando
let _leadQueue = null;

function getLeadQueue() {
  if (!_leadQueue) {
    _leadQueue = new Queue('lead-messages', { connection });
  }
  return _leadQueue;
}

// Proxy que permite usar leadQueue.add() sem crashar na inicialização
const leadQueue = {
  async add(name, data, opts) {
    try {
      const q = getLeadQueue();
      return await q.add(name, data, opts);
    } catch (err) {
      console.warn('[Queue] Redis indisponível — mensagem não enfileirada:', err.message);
      return null;
    }
  }
};

module.exports = { leadQueue, connection, getLeadQueue };
