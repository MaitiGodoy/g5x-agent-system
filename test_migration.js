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
  console.log('=== Teste de Migração Outbound ===\n');

  // 1. Criar lead no pipeline principal
  const lRes = await apiRequest('/api/leads', 'POST', {
    name: 'Roberto Outbound',
    company: 'Outbound Corp',
    phone: '11999999999',
    email: 'roberto@outbound.com',
    status: 'entrada_triagem',
    source: 'manual'
  });
  const crmLeadId = lRes.data.id;
  console.log('1. Lead criado no CRM principal. ID:', crmLeadId);

  // 2. Criar correspondente ob_lead
  // A API genérica permite cadastrar em ob_leads
  const obRes = await apiRequest('/api/ob-leads', 'POST', {
    crm_lead_id: crmLeadId,
    name: 'Roberto Outbound',
    company: 'Outbound Corp',
    status: 'em_cadencia',
    lead_replied: false
  });
  const obLeadId = obRes.data.id;
  console.log('2. OB Lead criado. ID:', obLeadId);

  // 3. Simular resposta via PUT /ob-leads/:id/reply
  console.log('3. Chamando reply para o ob_lead...');
  const replyRes = await apiRequest(`/api/ob-leads/${obLeadId}/reply`, 'PUT', {});
  console.log('   Reply status:', replyRes.status);
  console.log('   Reply data:', JSON.stringify(replyRes.data));

  // 4. Verificar se o ob_lead foi removido de ob_leads
  const allOb = await apiRequest('/api/ob-leads', 'GET');
  const foundOb = allOb.data.find(o => o.id === obLeadId);
  console.log('4. OB Lead ainda existe em ob_leads?', foundOb ? 'Sim (ERRO)' : 'Não (OK)');

  // 5. Verificar status do lead no pipeline principal
  const leadRes = await apiRequest(`/api/leads/${crmLeadId}`, 'GET');
  console.log('5. Lead status no CRM principal:', leadRes.data.status);
  console.log('   lead.migrated_from_outbound:', leadRes.data.migrated_from_outbound);

  if (leadRes.data.status === 'diagnostico_agendado' && leadRes.data.migrated_from_outbound === true && !foundOb) {
    console.log('\n✅ Teste de migração outbound concluído com SUCESSO!');
    process.exit(0);
  } else {
    console.log('\n❌ Teste falhou!');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
