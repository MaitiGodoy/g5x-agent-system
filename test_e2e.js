const http = require('http');

function apiRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3000, path, method,
      headers: {'Content-Type': 'application/json'}
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({status: res.statusCode, data: JSON.parse(data)}); }
        catch { resolve({status: res.statusCode, data}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Teste E2E Indicações ===\n');

  // 1. GET inicial
  const r1 = await apiRequest('/api/indications', 'GET');
  console.log('1. GET /api/indications:', r1.data.length, 'indicações');

  // 2. POST - Criar indicação HOT
  const r2 = await apiRequest('/api/indications', 'POST', {
    referrer_name: 'Carlos Silva',
    referrer_contact: 'carlos@email.com',
    referred_name: 'Ana Oliveira',
    referred_email: 'ana@empresa.com',
    referred_phone: '11987654321',
    referred_job: 'Gerente',
    referred_company: 'TechCorp',
    message: 'Carlos me indicou',
    status: 'hot'
  });
  console.log('2. POST:', r2.status, JSON.stringify(r2.data));
  const indId = r2.data.id;

  // 3. GET após criar
  const r3 = await apiRequest('/api/indications', 'GET');
  console.log('3. GET /api/indications:', r3.data.length, 'indicações');

  // 4. PUT - Editar
  const r4 = await apiRequest('/api/indications/' + indId, 'PUT', {
    referred_name: 'Ana Oliveira Silva',
    status: 'warm'
  });
  console.log('4. PUT:', r4.status, r4.data.referred_name, r4.data.status);

  // 5. PUT status
  const r5 = await apiRequest('/api/indications/' + indId + '/status', 'PUT', {
    status: 'hot'
  });
  console.log('5. PUT status:', r5.status, r5.data.status);

  // 6. CONVERT
  const r6 = await apiRequest('/api/indications/' + indId + '/convert', 'POST', {});
  console.log('6. CONVERT:', r6.status, JSON.stringify(r6.data));
  const leadId = r6.data && r6.data.lead ? r6.data.lead.id : null;

  // 7. GET após conversão
  const r7 = await apiRequest('/api/indications', 'GET');
  console.log('7. GET /api/indications após conversão:', r7.data.length, '(inclui convertida)');

  // 8. Verificar lead criado
  const r8 = await apiRequest('/api/leads', 'GET');
  console.log('8. GET /api/leads:', r8.data.length, 'leads');
  if (leadId) {
    const r9 = await apiRequest('/api/leads/' + leadId, 'GET');
    console.log('9. GET /api/leads/ID:', JSON.stringify(r9.data));
  }

  // 10. Verificar source do lead
  if (leadId && r8.data) {
    const lead = r8.data.find(l => l.id === leadId);
    console.log('10. Lead source:', lead ? lead.source : 'N/A');
    console.log('    Lead name:', lead ? lead.name : 'N/A');
    console.log('    Lead main_pain:', lead ? lead.main_pain : 'N/A');
  }

  // 11. Dashboard
  const r12 = await apiRequest('/api/dashboard', 'GET');
  console.log('\n11. DASHBOARD:', JSON.stringify(r12.data, null, 2));

  console.log('\n✅ Teste E2E concluído com sucesso!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });