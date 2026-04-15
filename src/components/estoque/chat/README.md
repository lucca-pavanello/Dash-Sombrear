# IA do Estoque

Chat com Gemini integrado ao módulo de estoque da Sombrear.

## Status: ATIVO em produção

## O que ela faz
- Responde perguntas sobre estoque, produtos, fornecedores e vendas
- Executa ações com sistema de confirmação por nível de risco
- Dá insights baseados nos dados reais do Supabase

## Sistema de níveis
- **Nível 1** — leitura/recálculos sem confirmação: resumo do estoque, produtos parados, sugestões de compra, recalcular ABC, gerar CSV
- **Nível 2** — cadastros com modal de confirmação laranja: cadastrar produto, fornecedor, localização, editar configuração
- **Nível 3** — operações críticas com modal vermelho de revisão: registrar entrada, registrar venda, mover item, inativar produto

## Arquitetura (Vite, client-side)
- `featureFlag.ts` — controla visibilidade (ativo em `PROD`)
- `store.ts` — estado Zustand global: aberto, mensagens, loading, confirmacaoPendente
- `useChatAPI.ts` — hook principal: chama Gemini SDK diretamente no browser
- `tools.ts` — 14 FunctionDeclarations do Gemini
- `systemPrompt.ts` — prompt com snapshot do estoque
- `executors.ts` — executores das tools via Supabase client
- `ChatDrawer.tsx` — drawer lateral (Radix Dialog)
- `ConfirmacaoAcao.tsx` — modal de confirmação (Radix Dialog)

## Configuração

### Variável de ambiente obrigatória na Vercel
```
VITE_GEMINI_API_KEY=AIza...
```

### Função SQL no Supabase
```sql
SELECT estoque_chat_contexto();
```
Deve retornar JSON com resumo, giro, top_produtos, sugestoes_compra, produtos_parados, fornecedores, localizacoes, configuracoes.

### Modelo Gemini
`gemini-2.5-flash-preview-05-20`

## Limitações conhecidas
- O snapshot é gerado a cada pergunta — pode adicionar 200–500ms de latência
- Limite de 20 produtos no top por valor (contexto controlado)
- Gemini pode ocasionalmente sugerir IDs inventados — revisar no modal antes de confirmar ações de Nível 3
- Histórico de conversa não persiste ao fechar o drawer
- API key exposta no bundle do cliente (padrão Vite — aceitável para projetos internos)
- Em alta latência da API Gemini, pode demorar 5–15s

## Rollback
Para desativar em produção sem redeploy, altere `featureFlag.ts` de volta para:
```typescript
export const isAIEstoqueEnabled = () =>
  import.meta.env.VITE_FEATURE_AI_ESTOQUE === 'true'
```
e faça push.
