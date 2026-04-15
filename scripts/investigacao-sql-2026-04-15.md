# Investigação SQL — Estado Real do Banco (2026-04-15)

> Gerado por `npm run auditoria:estoque:investigar`

## Resumo

- ✅ 8 OK
- ⚠️ 1 avisos
- ❌ 2 erros — **requerem ação**
- ℹ️ 3 informações

## Ações necessárias

Rode o arquivo `scripts/correcoes-sql.sql` no SQL Editor do Supabase.

Itens com erro:
- **estoque_config**: Erro ao ler: Invalid API key
- **vw_sugestao_compra**: View não existe ou erro: Invalid API key

## Detalhes

### ✅ fn:estoque_recalcular_abc

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_consumir_peps

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_calcular_giro

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_calcular_lec

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_calcular_desconto_combo

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_fn_capital_travado

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_fn_roi_estoque

Existe (erro de runtime: Invalid API key)

### ✅ fn:estoque_chat_contexto

Existe (erro de runtime: Invalid API key)

### ❌ estoque_config

Erro ao ler: Invalid API key

### ❌ vw_sugestao_compra

View não existe ou erro: Invalid API key

### ℹ️ estoque_vendas

0 venda(s) registrada(s) no banco

### ℹ️ peps_evidencia

0 item(ns) de lote com quantidade_restante < quantidade original (PEPS ativo)

### ℹ️ abc_classificados

0 produto(s) com classificação ABC definida

### ⚠️ migrations

Não foi possível verificar: Invalid API key

---
*Script: `npm run auditoria:estoque:investigar`*
