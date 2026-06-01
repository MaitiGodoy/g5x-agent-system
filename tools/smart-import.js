/**
 * Smart Import v2 — Motor de Importação Inteligente G5X com Madalena
 * 
 * Madalena analisa QUALQUER formato de lista e decide:
 * - O que cada coluna/campo significa
 * - Como extrair múltiplos contatos por empresa
 * - Quais dados mapear para o CRM
 * - Como enriquecer com dados públicos
 */

const fs = require('fs');
const path = require('path');
const llm = require('./llm');
const XLSX = require('xlsx');

// ── Schema do Lead CRM (todos os campos possíveis) ──
const CRM_FIELDS = {
  name: { desc: 'Nome do contato principal', examples: ['João Silva', 'Maria Santos'] },
  company: { desc: 'Nome da empresa / razão social / fantasia', examples: ['TechBR LTDA', 'Construtora ABC'] },
  fantasia: { desc: 'Nome fantasia da empresa', examples: ['TechBR', 'ABC Construções'] },
  razao_social: { desc: 'Razão social completa', examples: ['TechBR Tecnologia LTDA'] },
  email: { desc: 'Email principal do contato', examples: ['joao@techbr.com'] },
  phone: { desc: 'Telefone/WhatsApp do contato', examples: ['+5511999998888'] },
  job_title: { desc: 'Cargo/função do contato', examples: ['CEO', 'Gerente de Compras', 'Engenheiro'] },
  cnpj: { desc: 'CNPJ da empresa', examples: ['12.345.678/0001-90'] },
  cpf: { desc: 'CPF do contato', examples: ['123.456.789-00'] },
  city: { desc: 'Cidade', examples: ['São Paulo', 'Recife'] },
  state: { desc: 'Estado/UF', examples: ['SP', 'PE'] },
  address: { desc: 'Endereço completo', examples: ['Rua X, 123'] },
  neighborhood: { desc: 'Bairro', examples: ['Centro', 'Boa Viagem'] },
  zip_code: { desc: 'CEP', examples: ['01234-567'] },
  website: { desc: 'Site da empresa', examples: ['https://techbr.com'] },
  industry: { desc: 'Segmento/atividade/ramo', examples: ['Construção Civil', 'Tecnologia'] },
  value: { desc: 'Valor/faturamento/capital social', examples: [1000000] },
  source: { desc: 'Origem do lead', examples: ['import', 'intec'] },
  notes: { desc: 'Observações/detalhes', examples: ['Empresa de grande porte'] },
  linkedin_url: { desc: 'Perfil LinkedIn', examples: ['https://linkedin.com/in/joao'] },
  company_size: { desc: 'Porte da empresa', examples: ['Empresa de Pequeno Porte', 'Demais'] },
  legal_nature: { desc: 'Natureza jurídica', examples: ['SOCIEDADE EMPRESÁRIA LIMITADA'] },
  registration_date: { desc: 'Data de abertura/fundação', examples: ['2020-01-15'] },
  partners: { desc: 'Sócios/proprietários', examples: ['João Silva, Maria Santos'] },
  secondary_activities: { desc: 'Atividades secundárias', examples: ['Consultoria, Engenharia'] },
  status_cadastral: { desc: 'Situação cadastral', examples: ['ATIVA', 'BAIXADA'] },
  contact_name: { desc: 'Nome de contato adicional', examples: ['Carlos Oliveira'] },
  contact_email: { desc: 'Email de contato adicional', examples: ['carlos@empresa.com'] },
  contact_phone: { desc: 'Telefone de contato adicional', examples: ['+5511988887777'] },
  contact_role: { desc: 'Cargo de contato adicional', examples: ['Comprador', 'Engenheiro'] },
};

// ── Normalizadores ──
function normalizeName(name) {
  if (!name) return '';
  const lowercase = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'pel', 'van', 'von', 'di']);
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (lowercase.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('55') && cleaned.length >= 13) cleaned = cleaned.substring(2);
  if (cleaned.length >= 10 && cleaned.length <= 11) return '+55' + cleaned;
  if (cleaned.length === 12 || cleaned.length === 13) return '+55' + cleaned;
  return phone.toString().trim();
}

function normalizeEmail(email) {
  if (!email) return '';
  const match = email.trim().toLowerCase().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

function normalizeCompany(company) {
  if (!company) return '';
  return company
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(ltda|s\.?a\.?|eireli|me|ei|llc|inc|corp|co\.?)\b/gi, m => m.toUpperCase());
}

function normalizeCNPJ(cnpj) {
  if (!cnpj) return '';
  const digits = cnpj.toString().replace(/\D/g, '');
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cnpj.toString().trim();
}

function normalizeCEP(cep) {
  if (!cep) return '';
  const digits = cep.toString().replace(/\D/g, '');
  if (digits.length === 8) return digits.replace(/^(\d{5})(\d{3})/, '$1-$2');
  return cep.toString().trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

// ── Parse Excel ──
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const results = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (data.length > 0) {
      results.push({
        sheetName,
        headers: Object.keys(data[0]),
        rows: data
      });
    }
  }
  
  return results;
}

// ── Parse CSV ──
function parseCSV(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [{ headers: [], rows: [] }];
  
  const firstLine = lines[0];
  let sep = ',';
  if (firstLine.includes(';') && !firstLine.includes('\t')) sep = ';';
  else if (firstLine.includes('\t')) sep = '\t';
  else if (firstLine.includes('|')) sep = '|';
  
  const headers = firstLine.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length === headers.length) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
      rows.push(obj);
    }
  }
  
  return [{ headers, rows, sheetName: 'dados' }];
}

// ── Parse JSON ──
function parseJSON(raw) {
  const parsed = JSON.parse(raw);
  const data = Array.isArray(parsed) ? parsed : [parsed];
  const headers = Object.keys(data[0] || {});
  return [{ headers, rows: data, sheetName: 'dados' }];
}

// ── Madalena: Analisa estrutura e retorna mapeamento inteligente ──
async function madalenaAnalyze(headers, sampleRows, sheetName = '') {
  const sample = sampleRows.slice(0, 3);
  
  const prompt = `Você é Madalena, especialista em importação de dados para CRM B2B.

Analise esta planilha "${sheetName}" e retorne um JSON com:

1. "column_map": mapeie CADA coluna original para um campo do CRM.
   Campos CRM disponíveis: ${Object.keys(CRM_FIELDS).join(', ')}
   Se não mapear, use "ignore".
   
2. "contact_patterns": identifique colunas de contatos múltiplos.
   Ex: "Nome do Contato 1", "Nome do Contato 2" → padrão de contatos numerados.
   Retorne: { "name_pattern": "coluna", "email_pattern": "coluna", "phone_pattern": "coluna", "role_pattern": "coluna", "max_index": N }
   Se não houver contatos múltiplos, retorne null.

3. "multi_contact_strategy": se houver contatos múltiplos, como extrair?
   "one_lead_per_contact" = cada contato vira um lead separado
   "one_lead_per_company" = só o primeiro contato vira lead

4. "confidence": 0-100, quão confiante está no mapeamento.

HEADERS: ${JSON.stringify(headers)}

AMOSTRA (3 linhas):
${JSON.stringify(sample, null, 2)}

Regras:
- "Razão social" → razao_social, "Fantasia" → fantasia
- "Nome do Contato N" → contact_name (com index N)
- "Cargo N" → contact_role
- "Email do Contato N" → contact_email
- "Telefone do Contato N" → contact_phone
- "Sócios" → partners
- "Capital Social" → value
- "Porte" → company_size
- "Atividade Principal" → industry
- CNPJ, CEP, telefones → formatar corretamente
- Se houver 10+ contatos por empresa → multi_contact_strategy = "one_lead_per_contact"

Retorne APENAS JSON válido, sem markdown.`;

  try {
    const response = await llm.chat([
      { role: 'system', content: 'You are Madalena, a data analysis expert. Respond ONLY with valid JSON. No markdown, no code blocks.' },
      { role: 'user', content: prompt }
    ]);
    
    // Extrair JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log('[Madalena] IA falhou, usando heurística:', e.message);
  }
  
  return null;
}

// ── Heurística fallback ──
function heuristicAnalyze(headers, sampleRows) {
  // Aliases ordenados por especificidade (mais específico primeiro)
  const COLUMN_MAP = {
    name: ['nome', 'name', 'nome completo', 'contato', 'contact', 'cliente'],
    company: ['razão social', 'razao social', 'razao'],
    fantasia: ['fantasia', 'nome fantasia', 'fantasia nome'],
    razao_social: ['razão social', 'razao social'],
    email: ['e-mail', 'email', 'mail'],
    phone: ['telefone', 'phone', 'tel', 'celular', 'whatsapp', 'fone'],
    job_title: ['cargo', 'job title', 'função', 'funcao', 'posição', 'role'],
    cnpj: ['cnpj'],
    city: ['cidade', 'city', 'município', 'municipio'],
    state: ['estado', 'state', 'uf'],
    website: ['site', 'website', 'url'],
    industry: ['atividade principal', 'descricao da atividade principal', 'segmento', 'industry', 'setor', 'ramo de atividade'],
    value: ['capital social', 'valor', 'value', 'faturamento', 'receita'],
    notes: ['detalhes', 'details', 'obs', 'observações', 'observacoes', 'notas'],
    linkedin_url: ['linkedin', 'linkedin url'],
    address: ['endereço', 'endereco', 'logradouro', 'rua', 'avenida'],
    neighborhood: ['bairro'],
    zip_code: ['cep', 'zip code'],
    company_size: ['porte da empresa', 'porte', 'tamanho'],
    legal_nature: ['natureza jurídica', 'natureza juridica', 'descricao natureza juridica'],
    registration_date: ['data de abertura', 'data abertura', 'fundação'],
    partners: ['sócios', 'socios', 'proprietários', 'proprietarios'],
    status_cadastral: ['situação cadastral', 'situacao cadastral', 'status'],
    contact_name: ['nome do contato', 'contact name', 'pessoa responsavel', 'responsável'],
    contact_email: ['email do contato', 'contact email'],
    contact_phone: ['telefone do contato', 'contact phone'],
    contact_role: ['cargo do contato', 'contact role'],
  };
  
  const columnMap = {};
  const contactPatterns = { name_pattern: null, email_pattern: null, phone_pattern: null, role_pattern: null, max_index: 0 };
  
  // Passo 1: Detectar contatos numerados
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    
    const nomeContatoMatch = lower.match(/nome\s+do\s+contato\s+(\d+)/);
    if (nomeContatoMatch) {
      contactPatterns.name_pattern = header;
      contactPatterns.max_index = Math.max(contactPatterns.max_index, parseInt(nomeContatoMatch[1]));
      columnMap[header] = 'contact_name';
      continue;
    }
    
    const emailContatoMatch = lower.match(/email\s+do\s+contato\s+(\d+)/);
    if (emailContatoMatch) {
      contactPatterns.email_pattern = header;
      contactPatterns.max_index = Math.max(contactPatterns.max_index, parseInt(emailContatoMatch[1]));
      columnMap[header] = 'contact_email';
      continue;
    }
    
    const telContatoMatch = lower.match(/telefone\s+do\s+contato\s+(\d+)/);
    if (telContatoMatch) {
      contactPatterns.phone_pattern = header;
      contactPatterns.max_index = Math.max(contactPatterns.max_index, parseInt(telContatoMatch[1]));
      columnMap[header] = 'contact_phone';
      continue;
    }
    
    const cargoContatoMatch = lower.match(/cargo\s+do\s+contato\s+(\d+)/) || lower.match(/^cargo\s+(\d+)/);
    if (cargoContatoMatch) {
      contactPatterns.role_pattern = header;
      contactPatterns.max_index = Math.max(contactPatterns.max_index, parseInt(cargoContatoMatch[1]));
      columnMap[header] = 'contact_role';
      continue;
    }
  }
  
  // Passo 2: Mapear colunas restantes (primeiro match exato, depois parcial)
  const usedCategories = new Set();
  
  // Primeira passada: matches exatos
  for (const header of headers) {
    if (columnMap[header]) continue;
    const lower = header.toLowerCase().trim();
    
    for (const [category, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.includes(lower)) {
        columnMap[header] = category;
        usedCategories.add(category);
        break;
      }
    }
  }
  
  // Segunda passada: matches parciais (só se a categoria ainda não foi usada)
  for (const header of headers) {
    if (columnMap[header]) continue;
    const lower = header.toLowerCase().trim();
    let bestMatch = 'ignore';
    let bestScore = 0;
    
    for (const [category, aliases] of Object.entries(COLUMN_MAP)) {
      for (const alias of aliases) {
        let score = 0;
        if (lower.includes(alias)) score = 80;
        else if (alias.includes(lower) && lower.length > 3) score = 60;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = category;
        }
      }
    }
    
    columnMap[header] = bestMatch;
  }
  
  // Passo 3: Correções específicas
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    // Ignorar códigos IBGE, raiz CNPJ, datas de consulta
    if (lower.includes('codigo') && lower.includes('ibge')) columnMap[header] = 'ignore';
    if (lower.includes('raiz') && lower.includes('cnpj')) columnMap[header] = 'ignore';
    if (lower.includes('data') && lower.includes('consulta')) columnMap[header] = 'ignore';
    if (lower.includes('data') && lower.includes('op') && lower.includes('mei')) columnMap[header] = 'ignore';
    if (lower.includes('data') && lower.includes('exclus')) columnMap[header] = 'ignore';
    if (lower.includes('data') && lower.includes('simples')) columnMap[header] = 'ignore';
    if (lower.includes('codigo') && lower.includes('atividade')) columnMap[header] = 'ignore';
    if (lower.includes('codigos') && lower.includes('atividade')) columnMap[header] = 'ignore';
    if (lower.includes('numero') && lower.includes('filial')) columnMap[header] = 'ignore';
    if (lower.includes('matriz') && lower.includes('filial')) columnMap[header] = 'ignore';
    if (lower.includes('motivo') && lower.includes('situacao')) columnMap[header] = 'ignore';
    if (lower.includes('situacao') && lower.includes('especial')) columnMap[header] = 'ignore';
    if (lower.includes('ente') && lower.includes('federativo')) columnMap[header] = 'ignore';
    if (lower.includes('optante') && lower.includes('mei')) columnMap[header] = 'ignore';
    if (lower.includes('optante') && lower.includes('simples')) columnMap[header] = 'ignore';
    // Garantir mappings corretos
    if (lower === 'municipio' || lower === 'cidade') columnMap[header] = 'city';
    if (lower === 'cnpj') columnMap[header] = 'cnpj';
    if (lower === 'descricao da atividade principal') columnMap[header] = 'industry';
    if (lower === 'atividades secundarias') columnMap[header] = 'secondary_activities';
    if (lower.includes('descrição') && lower.includes('atividade')) columnMap[header] = 'secondary_activities';
  }
  
  return {
    column_map: columnMap,
    contact_patterns: contactPatterns.max_index > 0 ? contactPatterns : null,
    multi_contact_strategy: contactPatterns.max_index > 5 ? 'one_lead_per_contact' : 'one_lead_per_company',
    confidence: 70
  };
}

// ── Extrair valor de campo com suporte a padrões numerados ──
function getField(row, pattern, index) {
  if (!pattern) return '';
  // Tenta padrão com número
  const numPattern = pattern.replace(/\d+$/, index.toString());
  if (row[numPattern] !== undefined) return row[numPattern];
  // Tenta padrão original
  if (row[pattern] !== undefined) return row[pattern];
  // Tenta variações
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase();
    if (lower.includes(pattern.toLowerCase().replace(/\d+$/, '')) && lower.includes(index.toString())) {
      return row[key];
    }
  }
  return '';
}

// ── Processar lista completa ──
async function processList(input, options = {}) {
  const { useAI = true, skipDuplicates = true, enrichCNPJ = false, fileBuffer = null } = options;
  
  let sheets = [];
  let format = 'unknown';
  
  // 1. Detectar e parsear formato
  if (fileBuffer) {
    // Excel
    format = 'xlsx';
    sheets = parseExcel(fileBuffer);
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      format = 'json';
      sheets = parseJSON(trimmed);
    } else if (trimmed.includes('\n') || trimmed.includes(';') || trimmed.includes('\t')) {
      format = 'csv';
      sheets = parseCSV(trimmed);
    } else {
      format = 'free_text';
      return parseFreeText(trimmed);
    }
  } else if (Array.isArray(input)) {
    format = 'json';
    const headers = Object.keys(input[0] || {});
    sheets = [{ headers, rows: input, sheetName: 'dados' }];
  }
  
  if (sheets.length === 0 || sheets.every(s => s.rows.length === 0)) {
    return { leads: [], errors: ['Nenhum dado encontrado'] };
  }
  
  // 2. Para cada sheet, analisar com Madalena e extrair leads agrupados por empresa
  const allLeads = [];
  const allErrors = [];
  const allStats = { total_rows: 0, valid_leads: 0, duplicates_removed: 0, with_email: 0, with_phone: 0, with_company: 0, sheets_processed: 0, multi_contact_accounts: 0, total_contacts: 0 };
  
  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue;
    
    allStats.total_rows += sheet.rows.length;
    
    // 3. Análise inteligente
    let analysis;
    if (useAI) {
      analysis = await madalenaAnalyze(sheet.headers, sheet.rows, sheet.sheetName);
    }
    if (!analysis) {
      analysis = heuristicAnalyze(sheet.headers, sheet.rows);
    }
    
    const { column_map, contact_patterns, multi_contact_strategy } = analysis;
    
    // 4. Extrair leads agrupados por empresa (account-based)
    for (const row of sheet.rows) {
      const companyData = {};
      
      // Mapear campos da empresa
      for (const [col, value] of Object.entries(row)) {
        const category = column_map[col] || 'ignore';
        const val = (value || '').toString().trim();
        if (!val || val === '.' || val === 'None' || val === 'null') continue;
        
        switch (category) {
          case 'name': companyData.name = normalizeName(val); break;
          case 'company': companyData.company = normalizeCompany(val); break;
          case 'fantasia': companyData.fantasia = val; break;
          case 'razao_social': companyData.razao_social = val; break;
          case 'email': companyData.email = normalizeEmail(val); break;
          case 'phone': companyData.phone = normalizePhone(val); break;
          case 'job_title': companyData.job_title = val; break;
          case 'cnpj': companyData.cnpj = normalizeCNPJ(val); break;
          case 'city': companyData.city = val; break;
          case 'state': companyData.state = val.toUpperCase().substring(0, 2); break;
          case 'website': companyData.website = val.startsWith('http') ? val : 'https://' + val; break;
          case 'industry': companyData.industry = val; break;
          case 'value': companyData.value = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.')) || 0; break;
          case 'notes': companyData.notes = val; break;
          case 'address': companyData.address = val; break;
          case 'neighborhood': companyData.neighborhood = val; break;
          case 'zip_code': companyData.zip_code = normalizeCEP(val); break;
          case 'company_size': companyData.company_size = val; break;
          case 'legal_nature': companyData.legal_nature = val; break;
          case 'registration_date': companyData.registration_date = val; break;
          case 'partners': companyData.partners = val; break;
          case 'status_cadastral': companyData.status_cadastral = val; break;
          case 'secondary_activities': companyData.secondary_activities = val; break;
        }
      }
      
      // Garantir nome da empresa
      if (!companyData.company && companyData.razao_social) {
        companyData.company = companyData.razao_social;
      }
      if (!companyData.company && companyData.fantasia) {
        companyData.company = companyData.fantasia;
      }
      
      // Extrair contatos
      const contacts = [];
      
      if (contact_patterns && multi_contact_strategy === 'one_lead_per_contact') {
        // Multi-contato: extrair cada contato
        for (let i = 1; i <= contact_patterns.max_index; i++) {
          const contactName = getField(row, contact_patterns.name_pattern, i);
          const contactEmail = getField(row, contact_patterns.email_pattern, i);
          const contactPhone = getField(row, contact_patterns.phone_pattern, i);
          const contactRole = getField(row, contact_patterns.role_pattern, i);
          
          if (contactName && contactName.toLowerCase() !== 'restrito' && contactName.toLowerCase() !== 'a definir') {
            contacts.push({
              id: 'c' + i,
              name: normalizeName(contactName.replace(/\(.*?\)/g, '').trim()),
              email: contactEmail ? normalizeEmail(contactEmail.split('/')[0].trim()) : '',
              phone: contactPhone ? normalizePhone(contactPhone) : '',
              job_title: contactRole || '',
              cadence_step: 1,
              cadence_status: 'fila',
              last_contact: null,
              responded: false,
              notes: ''
            });
          }
        }
      } else if (companyData.name || companyData.email || companyData.phone) {
        // Single contact: usar dados principais
        contacts.push({
          id: 'c1',
          name: companyData.name || 'Sem nome',
          email: companyData.email || '',
          phone: companyData.phone || '',
          job_title: companyData.job_title || '',
          cadence_step: 1,
          cadence_status: 'fila',
          last_contact: null,
          responded: false,
          notes: ''
        });
      } else if (companyData.partners) {
        // Extrair dos sócios
        const partnerList = companyData.partners.split(',');
        partnerList.forEach((p, idx) => {
          const cleaned = p
            .replace(/S[oó]cio-?Administrador\s*[-–—]?\s*/gi, '')
            .replace(/S[oó]cio\s*[-–—]?\s*/gi, '')
            .replace(/Administrador\s*[-–—]?\s*/gi, '')
            .replace(/^[-–—\s]+/, '')
            .trim();
          if (cleaned) {
            contacts.push({
              id: 'c' + (idx + 1),
              name: normalizeName(cleaned),
              email: companyData.email || '',
              phone: companyData.phone || '',
              job_title: idx === 0 ? 'Sócio/Administrador' : 'Sócio',
              cadence_step: 1,
              cadence_status: 'fila',
              last_contact: null,
              responded: false,
              notes: ''
            });
          }
        });
      }
      
      // Se não tem contatos, pula
      if (contacts.length === 0) continue;
      
      // Identificar decisor principal (prioridade: CEO/Diretor > Comprador > Gerente > Outros)
      const decisionPriority = ['ceo', 'founder', 'presidente', 'dono', 'proprietário', 'sócio', 'diretor', 'vp', 'vice', 'gerente de compras', 'gerente', 'comprador', 'coordenador', 'analista', 'contato', 'engenheiro'];
      
      contacts.sort((a, b) => {
        const aTitle = (a.job_title || '').toLowerCase();
        const bTitle = (b.job_title || '').toLowerCase();
        const aScore = decisionPriority.findIndex(p => aTitle.includes(p));
        const bScore = decisionPriority.findIndex(p => bTitle.includes(p));
        return (aScore === -1 ? 999 : aScore) - (bScore === -1 ? 999 : bScore);
      });
      
      // Marcar primeiro como decisor principal
      contacts[0].is_primary = true;
      
      // Criar account (lead com contatos)
      const primaryContact = contacts[0];
      const account = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        // Dados da empresa
        company: companyData.company || primaryContact.name,
        fantasia: companyData.fantasia || '',
        razao_social: companyData.razao_social || '',
        cnpj: companyData.cnpj || '',
        city: companyData.city || '',
        state: companyData.state || '',
        website: companyData.website || '',
        industry: companyData.industry || '',
        value: companyData.value || 0,
        address: companyData.address || '',
        neighborhood: companyData.neighborhood || '',
        zip_code: companyData.zip_code || '',
        company_size: companyData.company_size || '',
        legal_nature: companyData.legal_nature || '',
        registration_date: companyData.registration_date || '',
        partners: companyData.partners || '',
        status_cadastral: companyData.status_cadastral || '',
        secondary_activities: companyData.secondary_activities || '',
        notes: companyData.notes || '',
        // Contato principal (para compatibilidade com CRM existente)
        name: primaryContact.name,
        email: primaryContact.email || '',
        phone: primaryContact.phone || '',
        job_title: primaryContact.job_title || '',
        // Contatos vinculados
        contacts: contacts,
        // Pipeline
        source: 'import',
        status: 'novo',
        partner_id: '',
        linkedin_url: primaryContact.linkedin_url || '',
        last_stage_change: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      // Limpar campos vazios
      Object.keys(account).forEach(k => {
        if (account[k] === '' || account[k] === undefined || account[k] === null || (k !== 'contacts' && k === 'contacts' && account[k].length === 0)) {
          if (k !== 'contacts') delete account[k];
        }
      });
      
      allLeads.push(account);
      allStats.total_contacts += contacts.length;
      if (contacts.length > 1) allStats.multi_contact_accounts++;
    }
    
    allStats.sheets_processed++;
  }
  
  // 6. Validações
  for (const account of allLeads) {
    if (account.email && !validateEmail(account.email)) {
      allErrors.push(`Email inválido: "${account.email}" para ${account.name || account.company}`);
      delete account.email;
    }
    if (account.phone && !validatePhone(account.phone)) {
      delete account.phone;
    }
    // Validar contatos
    if (account.contacts) {
      account.contacts = account.contacts.filter(c => {
        if (c.email && !validateEmail(c.email)) {
          allErrors.push(`Email inválido: "${c.email}" para ${c.name} (${account.company})`);
          c.email = '';
        }
        return c.name || c.email || c.phone; // Só mantém se tem pelo menos um dado
      });
    }
    if (account.email) allStats.with_email++;
    if (account.phone) allStats.with_phone++;
    if (account.company) allStats.with_company++;
  }
  
  // 7. Detectar duplicatas por CNPJ ou nome da empresa
  if (skipDuplicates) {
    const seen = new Map();
    const uniqueLeads = [];
    let dupCount = 0;
    
    for (const account of allLeads) {
      const key = (account.cnpj || account.company || (account.name + account.city)).toLowerCase().replace(/\s/g, '');
      if (seen.has(key)) {
        // Merge contacts into existing account
        const existing = seen.get(key);
        if (account.contacts && account.contacts.length > 0) {
          if (!existing.contacts) existing.contacts = [];
          const existingEmails = new Set(existing.contacts.map(c => c.email).filter(Boolean));
          for (const c of account.contacts) {
            if (!existingEmails.has(c.email) && !existing.contacts.find(ec => ec.name === c.name)) {
              existing.contacts.push(c);
            }
          }
        }
        dupCount++;
      } else {
        seen.set(key, account);
        uniqueLeads.push(account);
      }
    }
    
    allStats.duplicates_removed = dupCount;
    allStats.valid_leads = uniqueLeads.length;
    allLeads.length = 0;
    allLeads.push(...uniqueLeads);
  } else {
    allStats.valid_leads = allLeads.length;
  }
  
  // 8. Enriquecimento CNPJ (opcional)
  if (enrichCNPJ) {
    const https = require('https');
    for (const account of allLeads) {
      if (account.cnpj && !account.company) {
        const cnpjDigits = account.cnpj.replace(/\D/g, '');
        if (cnpjDigits.length === 14) {
          try {
            const data = await new Promise((resolve) => {
              https.get(`https://receitaws.com.br/v1/cnpj/${cnpjDigits}`, (resp) => {
                let data = '';
                resp.on('data', chunk => data += chunk);
                resp.on('end', () => {
                  try { resolve(JSON.parse(data)); }
                  catch { resolve(null); }
                });
              }).on('error', () => resolve(null));
            });
            
            if (data && data.status !== 'ERROR') {
              account.company = account.company || data.nome || '';
              account.phone = account.phone || data.telefone || '';
              account.email = account.email || data.email || '';
              account.industry = account.industry || data.atividade_principal?.[0]?.text || '';
            }
          } catch {}
        }
      }
    }
  }
  
  return {
    leads: allLeads,
    errors: allErrors,
    stats: allStats,
    analysis: { format, sheets_processed: allStats.sheets_processed }
  };
}

function createCompanyLead(data) {
  // Extrair nome dos sócios limpando prefixos
  let extractedName = data.name || '';
  if (!extractedName && data.partners) {
    const firstPartner = data.partners.split(',')[0]
      .replace(/S[oó]cio-?Administrador\s*[-–—]?\s*/gi, '')
      .replace(/S[oó]cio\s*[-–—]?\s*/gi, '')
      .replace(/Administrador\s*[-–—]?\s*/gi, '')
      .replace(/^[-–—\s]+/, '')
      .trim();
    extractedName = normalizeName(firstPartner);
  }
  
  const lead = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: extractedName || 'Sem nome',
    company: data.company || '',
    fantasia: data.fantasia || '',
    razao_social: data.razao_social || '',
    email: data.email || '',
    phone: data.phone || '',
    job_title: data.job_title || '',
    cnpj: data.cnpj || '',
    city: data.city || '',
    state: data.state || '',
    website: data.website || '',
    industry: data.industry || '',
    value: data.value || 0,
    source: 'import',
    status: 'novo',
    partner_id: '',
    linkedin_url: '',
    notes: data.notes || '',
    address: data.address || '',
    neighborhood: data.neighborhood || '',
    zip_code: data.zip_code || '',
    company_size: data.company_size || '',
    legal_nature: data.legal_nature || '',
    registration_date: data.registration_date || '',
    partners: data.partners || '',
    status_cadastral: data.status_cadastral || '',
    secondary_activities: data.secondary_activities || '',
    last_stage_change: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  
  // Limpar campos vazios
  Object.keys(lead).forEach(k => {
    if (lead[k] === '' || lead[k] === undefined || lead[k] === null) delete lead[k];
  });
  
  return lead;
}

// ── Parse de texto livre (sem headers) ──
function parseFreeText(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const leads = [];
  
  for (const line of lines) {
    const lead = {};
    
    const emails = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails) lead.email = emails[0];
    
    let phones = line.match(/(\+?55)?\s*\(?\d{2}\)?\s*\d{4,5}[\s-]?\d{4}/g);
    if (!phones || phones.length === 0) {
      const digitMatches = line.match(/\+?55\s*\d{10,13}|\b\d{10,13}\b/g);
      if (digitMatches) phones = digitMatches;
    }
    if (phones && phones.length > 0) lead.phone = phones[0];
    
    let remainder = line
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/(\+?55)?\s*\(?\d{2}\)?\s*\d{4,5}[\s-]?\d{4}/g, '')
      .replace(/\+?55\s*\d{10,13}/g, '')
      .replace(/\b\d{10,13}\b/g, '')
      .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (remainder) {
      let parts = [];
      if (remainder.includes(',')) parts = remainder.split(',').map(p => p.trim()).filter(Boolean);
      else if (remainder.includes(' - ')) parts = remainder.split(' - ').map(p => p.trim()).filter(Boolean);
      else if (remainder.includes('\t')) parts = remainder.split('\t').map(p => p.trim()).filter(Boolean);
      else parts = [remainder];
      
      const cleaned = parts.map(p => p.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim()).filter(Boolean);
      if (cleaned.length >= 2) {
        lead.company = cleaned[0];
        lead.name = cleaned[1];
        if (cleaned.length >= 3) lead.job_title = cleaned[2];
      } else {
        lead.name = cleaned[0] || remainder;
      }
    }
    
    if (lead.name || lead.email || lead.phone) {
      leads.push(createCompanyLead(lead));
    }
  }
  
  return { leads, errors: [], stats: { total_rows: lines.length, valid_leads: leads.length, duplicates_removed: 0, with_email: leads.filter(l => l.email).length, with_phone: leads.filter(l => l.phone).length, with_company: leads.filter(l => l.company).length, format_detected: 'free_text' } };
}

module.exports = {
  processList,
  normalizeName,
  normalizePhone,
  normalizeEmail,
  normalizeCompany,
  normalizeCNPJ,
  normalizeCEP,
  validateEmail,
  validatePhone,
  parseExcel,
  parseCSV,
  parseJSON,
  parseFreeText,
  madalenaAnalyze,
  heuristicAnalyze,
  createCompanyLead
};
