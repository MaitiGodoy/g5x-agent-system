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
  console.log('=== Teste de Configuração do Agente e MCP Toggles ===\n');

  // 1. GET inicial do config
  const r1 = await apiRequest('/api/agent-config', 'GET');
  console.log('1. GET /api/agent-config status:', r1.status);
  console.log('   Config do Agente:', JSON.stringify(r1.data));
  console.log('   mcps padrão existem?', !!r1.data.mcps);
  console.log('   whatsapp habilitado por padrão?', r1.data.mcps?.whatsapp?.enabled);

  // 2. PUT para atualizar config (habilitar whatsapp, trocar nome)
  const updatedConfig = {
    ...r1.data,
    nome: 'Madalena Editada',
    mcps: {
      ...r1.data.mcps,
      whatsapp: { ...r1.data.mcps?.whatsapp, enabled: true }
    }
  };
  const r2 = await apiRequest('/api/agent-config', 'PUT', updatedConfig);
  console.log('2. PUT /api/agent-config status:', r2.status);
  console.log('   Nome retornado:', r2.data.nome);
  console.log('   whatsapp habilitado retornado?', r2.data.mcps?.whatsapp?.enabled);

  // 3. GET final para verificar persistência
  const r3 = await apiRequest('/api/agent-config', 'GET');
  console.log('3. GET final /api/agent-config:');
  console.log('   Nome persistido:', r3.data.nome);
  console.log('   whatsapp habilitado persistido?', r3.data.mcps?.whatsapp?.enabled);

  if (r3.data.nome === 'Madalena Editada' && r3.data.mcps?.whatsapp?.enabled === true) {
    console.log('\n✅ Teste de configuração e toggles MCP concluído com SUCESSO!');
    process.exit(0);
  } else {
    console.log('\n❌ Teste falhou!');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
