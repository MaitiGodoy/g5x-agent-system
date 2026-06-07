const fs = require('fs');
const path = require('path');

const DATA_DIR = (process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)) ? process.env.DATA_DIR : path.join(__dirname, '..');
const dbFile = path.join(DATA_DIR, 'crm-db.json');
const lockFile = path.join(DATA_DIR, 'crm-db.lock');
const tempFile = path.join(DATA_DIR, 'crm-db.json.tmp');

const RETRIES = 5;
const RETRY_DELAY = 50;

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 200;

function acquireLock() {
  for (let i = 0; i < RETRIES; i++) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (i < RETRIES - 1) {
        const wait = RETRY_DELAY * Math.pow(2, i);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
      }
    }
  }
  return false;
}

function releaseLock() {
  try { fs.unlinkSync(lockFile); } catch {}
}

function readDb() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return JSON.parse(JSON.stringify(_cache));
  try {
    if (!acquireLock()) throw new Error('Timeout ao adquirir lock de leitura');
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    _cache = data;
    _cacheTime = now;
    return JSON.parse(JSON.stringify(data));
  } catch {
    return {};
  } finally {
    releaseLock();
  }
}

function writeDb(data) {
  if (!acquireLock()) throw new Error('Timeout ao adquirir lock de escrita');
  try {
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, json, 'utf8');
    fs.renameSync(tempFile, dbFile);
    _cache = JSON.parse(JSON.stringify(data));
    _cacheTime = Date.now();
    return true;
  } finally {
    releaseLock();
  }
}

function getTable(name) {
  const db = readDb();
  if (!db[name]) db[name] = [];
  return db[name];
}

function pushTable(name, item) {
  const db = readDb();
  if (!db[name]) db[name] = [];
  db[name].push(item);
  writeDb(db);
  return item;
}

function updateInTable(tableName, id, updates) {
  const db = readDb();
  const table = db[tableName] || [];
  const idx = table.findIndex(i => i.id === id);
  if (idx === -1) return null;
  table[idx] = { ...table[idx], ...updates, updated_at: new Date().toISOString() };
  writeDb(db);
  return table[idx];
}

function deleteFromTable(tableName, id) {
  const db = readDb();
  const table = db[tableName] || [];
  const before = table.length;
  db[tableName] = table.filter(i => i.id !== id);
  writeDb(db);
  return db[tableName].length < before;
}

function genId() {
  return require('crypto').randomUUID();
}

// ── Per‑lead mutex ──
const leadLocks = new Map();

async function withLeadLock(leadId, fn) {
  while (leadLocks.get(leadId)) {
    await new Promise(r => setTimeout(r, 50));
  }
  leadLocks.set(leadId, true);
  try {
    return await fn();
  } finally {
    leadLocks.set(leadId, false);
  }
}

function cleanInput(obj) {
  const safe = JSON.parse(JSON.stringify(obj));
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(safe)) {
    if (dangerous.includes(key)) delete safe[key];
  }
  return safe;
}

module.exports = {
  readDb,
  writeDb,
  getTable,
  pushTable,
  updateInTable,
  deleteFromTable,
  genId,
  cleanInput,
  withLeadLock,
  leadLocks,
};
