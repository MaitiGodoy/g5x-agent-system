// crm/bridge.js
// Ponte entre o CRM HTML e o banco de dados Supabase
// Substitui o localStorage por chamadas à API

const API_BASE = window.location.origin + '/api';

async function apiFetch(endpoint, fallback = []) {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar ${endpoint}:`, error.message);
    return fallback;
  }
}

async function apiSend(endpoint, data, method = 'POST') {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`❌ Erro ao enviar para ${endpoint}:`, error.message);
    return null;
  }
}

async function apiDelete(endpoint) {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error(`❌ Erro ao deletar ${endpoint}:`, error.message);
    return false;
  }
}

async function apiUpload(endpoint, formData) {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`❌ Erro no upload para ${endpoint}:`, error.message);
    return null;
  }
}

window.G5XBridge = {
  // LEADS
  getLeads: (params) => apiFetch(`leads${params ? '?' + new URLSearchParams(params) : ''}`),
  getLead: (id) => apiFetch(`leads/${id}`),
  createLead: (data) => apiSend('leads', data, 'POST'),
  updateLead: (id, data) => apiSend(`leads/${id}`, data, 'PUT'),
  moveLeadStage: (id, status) => apiSend(`leads/${id}/stage`, { status }, 'PUT'),
  deleteLead: (id) => apiDelete(`leads/${id}`),
  importLeads: (formData) => apiUpload('leads/import', formData),
  importLeadsText: (text, options = {}) => apiSend('leads/import-text', { text, ...options }, 'POST'),
  previewImport: (formData) => apiUpload('leads/import-preview', formData),
  normalizeLead: (id) => apiSend(`leads/${id}/normalize`, {}, 'POST'),

  // PARTNERS
  getPartners: () => apiFetch('partners'),
  createPartner: (data) => apiSend('partners', data, 'POST'),
  updatePartner: (id, data) => apiSend(`partners/${id}`, data, 'PUT'),
  deletePartner: (id) => apiDelete(`partners/${id}`),

  // STAGES
  getStages: () => apiFetch('stages'),

  // TASKS
  getTasks: (params) => apiFetch(`tasks${params ? '?' + new URLSearchParams(params) : ''}`),
  createTask: (data) => apiSend('tasks', data, 'POST'),
  updateTask: (id, data) => apiSend(`tasks/${id}`, data, 'PUT'),

  // CADENCES
  getCadences: () => apiFetch('cadences'),
  createCadence: (data) => apiSend('cadences', data, 'POST'),
  updateCadence: (id, data) => apiSend(`cadences/${id}`, data, 'PUT'),
  deleteCadence: (id) => apiDelete(`cadences/${id}`),

  // OUTBOUND LEADS
  getObLeads: () => apiFetch('ob-leads'),
  createObLead: (data) => apiSend('ob-leads', data, 'POST'),
  updateObLead: (id, data) => apiSend(`ob-leads/${id}`, data, 'PUT'),
  deleteObLead: (id) => apiDelete(`ob-leads/${id}`),
  getObHistory: (id) => apiFetch(`ob-leads/${id}/history`),
  addObHistory: (id, data) => apiSend(`ob-leads/${id}/history`, data, 'POST'),
  replyObLead: (id) => apiSend(`ob-leads/${id}/reply`, {}, 'PUT'),
  migrateObLead: (id) => apiSend('outbound/migrate', { lead_id: id }, 'POST'),

  // COMM LOG
  getCommLog: (params) => apiFetch(`comm-log${params ? '?' + new URLSearchParams(params) : ''}`),
  addCommLog: (data) => apiSend('comm-log', data, 'POST'),

  // SEND MESSAGE
  sendMessage: (data) => apiSend('send-message', data, 'POST'),

  // GELADEIRA
  getGeladeira: () => apiFetch('geladeira'),
  updateGeladeira: (id, data) => apiSend(`geladeira/${id}`, data, 'PUT'),
  deleteGeladeira: (id) => apiDelete(`geladeira/${id}`),

  // KNOWLEDGE
  getKnowledgeDocs: () => apiFetch('knowledge/docs'),
  uploadKnowledge: (formData) => apiUpload('knowledge/upload', formData),
  deleteKnowledgeDoc: (id) => apiDelete(`knowledge/docs/${id}`),
  getKnowledgeUrls: () => apiFetch('knowledge/urls'),
  addKnowledgeUrl: (data) => apiSend('knowledge/urls', data, 'POST'),
  deleteKnowledgeUrl: (id) => apiDelete(`knowledge/urls/${id}`),
  getKnowledgeFaq: () => apiFetch('knowledge/faq'),
  addKnowledgeFaq: (data) => apiSend('knowledge/faq', data, 'POST'),
  updateKnowledgeFaq: (id, data) => apiSend(`knowledge/faq/${id}`, data, 'PUT'),
  deleteKnowledgeFaq: (id) => apiDelete(`knowledge/faq/${id}`),
  getKnowledgeObjections: () => apiFetch('knowledge/objections'),
  addKnowledgeObjection: (data) => apiSend('knowledge/objections', data, 'POST'),
  updateKnowledgeObjection: (id, data) => apiSend(`knowledge/objections/${id}`, data, 'PUT'),
  deleteKnowledgeObjection: (id) => apiDelete(`knowledge/objections/${id}`),
  getKnowledgeTexts: () => apiFetch('knowledge/texts'),
  addKnowledgeText: (data) => apiSend('knowledge/texts', data, 'POST'),
  updateKnowledgeText: (id, data) => apiSend(`knowledge/texts/${id}`, data, 'PUT'),
  deleteKnowledgeText: (id) => apiDelete(`knowledge/texts/${id}`),
  getObservations: () => apiFetch('knowledge/observations'),
  addObservation: (data) => apiSend('knowledge/observations', data, 'POST'),

  // AGENT CONFIG
  getAgentConfig: () => apiFetch('agent-config'),
  updateAgentConfig: (data) => apiSend('agent-config', data, 'PUT'),

  // AGENT LOG
  getAgentLog: (limit) => apiFetch(`agent-log?limit=${limit || 100}`),

  // ACTIVITY LOG
  getActivityLog: (limit) => apiFetch(`activity-log?limit=${limit || 100}`),

  // CHAT
  getChatHistory: () => apiFetch('chat'),
  sendChatMessage: (message) => apiSend('chat', { message }, 'POST'),

  // LINKEDIN
  getLinkedInStatus: () => apiFetch('linkedin/status'),

  // DASHBOARD
  getDashboard: () => apiFetch('dashboard'),

  // INDICATIONS
  getIndications: () => apiFetch('indications'),
  createIndication: (data) => apiSend('indications', data, 'POST'),
  updateIndication: (id, data) => apiSend(`indications/${id}`, data, 'PUT'),
  deleteIndication: (id) => apiDelete(`indications/${id}`),
  convertIndication: (id) => apiSend(`indications/${id}/convert`, {}, 'POST'),

  // SCHEDULING (G5X Booking)
  getBookingConfig: () => apiFetch('booking/config'),
  updateBookingConfig: (data) => apiSend('booking/config', data, 'PUT'),
  getBookingSlots: (date) => apiFetch(`booking/slots/${date}`),
  confirmBooking: (data) => apiSend('booking/confirm', data, 'POST'),
  getBookings: () => apiFetch('bookings'),
  cancelBooking: (id) => apiSend(`bookings/${id}/cancel`, {}, 'PUT'),
  
  // HIL (Human-in-the-Loop)
  getHILQueue: () => apiFetch('hil-queue'),
  resolveHIL: (id, resolution) => apiSend(`hil-queue/${id}`, { resolution }, 'PUT'),
  
  // Agent Engine
  getEngineStatus: () => apiFetch('agent/status'),
  startEngine: () => apiSend('agent/start', {}, 'POST'),
  stopEngine: () => apiSend('agent/stop', {}, 'POST'),
  getEngineLog: (limit) => apiFetch(`agent/log?limit=${limit || 50}`),
  getLiveActions: () => apiFetch('agent/status').then(s => s.liveActions || []),

  // STATUS
  isConnected: async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      return res.ok;
    } catch {
      return false;
    }
  }
};

console.log('✅ G5X Bridge carregado — API:', API_BASE);
