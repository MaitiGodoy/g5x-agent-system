# Versionamento G5X MASTER OS

## Versões

| Versão | Ambiente | Status | Data | Descrição |
|--------|----------|--------|------|-----------|
| v25-estavel | VPS | ✅ Produção | 2026-05-16 | Versão estável com fixes do Claude |
| v25-dev | PC | 🔄 Desenvolvimento | 2026-05-16 | Versão local para testes |

## Changelog

### v25-estavel (2026-05-16)
- ✅ LeadCard: Fix React.createElement nesting
- ✅ ChatView: Controlled component (sem perda de foco)
- ✅ Debug overlay removido
- ✅ Console.logs limpos
- ✅ Docker deploy configurado

### v25-dev (2026-05-16)
- Sincronia PC↔VPS desativada
- Desenvolvimento local isolado

## Política de Deploy

1. **PC (Local)**: Ambiente de desenvolvimento
   - Alterações são feitas e testadas aqui
   - Não afeta a VPS automaticamente

2. **VPS (Produção)**: Ambiente estável
   - Só recebe atualizações quando o usuário solicitar
   - Comando para atualizar: "atualizar VPS" ou "deploy para VPS"

3. **Processo de Deploy**:
   - Testar localmente primeiro
   - Criar backup da versão VPS
   - Enviar arquivos via SCP/rsync
   - Rebuild dos containers na VPS
   - Verificar health check

## Controle de Sincronização

Arquivo: `.sync-control`
- `STATUS=DESATIVADO` - PC não envia para VPS automaticamente
- `STATUS=LIBERADO` - Deploy manual permitido
