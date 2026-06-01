// G5X CRM — Knowledge Upload Deep Test
// Tests the full RAG pipeline: upload → ingest → search
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';

async function testKnowledgeUpload() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  📚 KNOWLEDGE UPLOAD DEEP TEST           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. Create a test TXT file
  const testTxtPath = path.join(__dirname, 'uploads', 'test_knowledge.txt');
  const testContent = `G5X Crédito Estruturado - Base de Conhecimento

A G5X é uma empresa especializada em crédito estruturado para empresas de médio e grande porte.
Nosso principal produto é o crédito com garantia real, onde oferecemos até 5x o faturamento da empresa.

PROCESSO DE ANÁLISE:
1. Entrada e Triagem — O lead é classificado automaticamente por origem (intec ou indicação)
2. Diagnóstico Agendado — Uma call de 15 minutos é marcada para entender as necessidades
3. Viabilidade Técnica — Balanço patrimonial e rating de crédito são processados
4. Apresentação de Teto — Oferta de até 5x o faturamento é apresentada
5. Diligência Matriz — Pasta técnica é montada para análise final
6. Crédito na Tela — Contrato fechado, honorários no êxito cobrados

OBJEÇÕES COMUNS:
- "O banco me oferece taxa menor" → Bancos de varejo não operam crédito estruturado. Nós oferecemos linhas que bancos tradicionais não conseguem aprovar.
- "Preciso pensar" → Usar técnica Voss: "O que está te impedindo de avançar?"
- "É muito caro" → O ROI médio dos nossos clientes é de 5x o valor investido.

INFORMAÇÕES DE CONTATO:
- Telefone: (11) 99999-0000
- Email: contato@g5x.com.br
- CNPJ: 12.345.678/0001-99`;

  fs.writeFileSync(testTxtPath, testContent, 'utf8');
  console.log('  ✅ Arquivo de teste criado:', testTxtPath);

  // 2. Upload via multipart form
  console.log('\n── Upload TXT via API ──');
  try {
    const boundary = '----WebKitFormBoundary' + Date.now();
    const fileBuffer = fs.readFileSync(testTxtPath);
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_knowledge.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const resp = await fetch(`${BASE}/api/knowledge/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: payload,
    });
    const result = await resp.json();
    console.log(`  ${resp.ok ? '✅' : '❌'} [${resp.status}] Upload:`, JSON.stringify(result, null, 2));

    if (result.success) {
      // 3. Verify it appears in the docs list
      console.log('\n── Verificar listagem ──');
      const listResp = await fetch(`${BASE}/api/knowledge/docs`);
      const docs = await listResp.json();
      const found = docs.find(d => d.id === result.doc?.id);
      console.log(`  ${found ? '✅' : '❌'} Documento encontrado na listagem`);
      if (found) {
        console.log(`    title: ${found.title}`);
        console.log(`    name: ${found.name}`);
        console.log(`    filename: ${found.filename}`);
        console.log(`    chunks: ${found.chunks?.length || 0}`);
        console.log(`    char_count: ${found.char_count}`);
      }

      // 4. Test RAG search
      console.log('\n── RAG Search Test ──');
      const chatResp = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Quais são as objeções comuns dos leads?' }),
      });
      const chatResult = await chatResp.json();
      console.log(`  ${chatResp.ok ? '✅' : '❌'} [${chatResp.status}] Chat com RAG`);
      if (chatResult.content) {
        console.log(`  Resposta (truncada): ${chatResult.content.substring(0, 300)}...`);
      }

      // 5. Delete the test doc
      console.log('\n── Cleanup ──');
      if (result.doc?.id) {
        const delResp = await fetch(`${BASE}/api/knowledge/docs/${result.doc.id}`, { method: 'DELETE' });
        console.log(`  ${delResp.ok ? '✅' : '❌'} Documento de teste deletado`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Falha: ${e.message}`);
    console.log(e.stack);
  }

  // 6. Test PDF upload if a PDF exists
  console.log('\n── Upload PDF Test ──');
  const pdfFiles = [
    path.join('C:\\Users\\user\\Downloads', 'Cadencia Antifragil (1).pdf'),
    path.join('C:\\Users\\user\\Downloads', 'Cadência Geric.pdf'),
  ];
  
  for (const pdfPath of pdfFiles) {
    if (fs.existsSync(pdfPath)) {
      console.log(`  Testando: ${path.basename(pdfPath)}`);
      try {
        const boundary = '----WebKitFormBoundary' + Date.now();
        const fileBuffer = fs.readFileSync(pdfPath);
        const payload = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(pdfPath)}"\r\nContent-Type: application/pdf\r\n\r\n`),
          fileBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const resp = await fetch(`${BASE}/api/knowledge/upload`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body: payload,
        });
        const result = await resp.json();
        console.log(`  ${resp.ok ? '✅' : '❌'} [${resp.status}] ${path.basename(pdfPath)}: ${JSON.stringify(result).substring(0, 200)}`);
        
        // Keep the PDF uploaded — don't delete
      } catch (e) {
        console.log(`  ❌ PDF upload failed: ${e.message}`);
      }
      break; // Only test one PDF
    }
  }

  // 7. Final check — list all docs
  console.log('\n── Final Docs List ──');
  try {
    const listResp = await fetch(`${BASE}/api/knowledge/docs`);
    const docs = await listResp.json();
    console.log(`  Total docs: ${docs.length}`);
    docs.forEach(d => {
      console.log(`    📄 ${d.title || d.name || d.filename || '?'} (${d.content_type || '?'}) — ${d.char_count || '?'} chars, ${d.chunks?.length || 0} chunks`);
    });
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }

  // Cleanup test file
  try { fs.unlinkSync(testTxtPath); } catch {}

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  📚 KNOWLEDGE TEST COMPLETO              ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

testKnowledgeUpload().catch(console.error);
