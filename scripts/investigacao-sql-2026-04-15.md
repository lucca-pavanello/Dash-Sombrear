# Investigação SQL — Estado Real do Banco (2026-04-15)

> Gerado por `npm run auditoria:estoque:investigar`

## Resumo

- ✅ 9 OK
- ⚠️ 1 avisos
- ❌ 1 erros — **requerem ação**
- ℹ️ 3 informações

## Ações necessárias

Rode o arquivo `scripts/correcoes-sql.sql` no SQL Editor do Supabase.

Itens com erro:
- **estoque_config**: TABELA VAZIA — popular com B1 de correcoes-sql.sql

## Detalhes

### ✅ fn:estoque_recalcular_abc

Existe e executa sem parâmetros

### ✅ fn:estoque_consumir_peps

Existe (requer parâmetros — heurística confirmou)

### ✅ fn:estoque_calcular_giro

Existe e executa sem parâmetros

### ✅ fn:estoque_calcular_lec

Existe (requer parâmetros — heurística confirmou)

### ✅ fn:estoque_calcular_desconto_combo

Existe (requer parâmetros — heurística confirmou)

### ✅ fn:estoque_fn_capital_travado

Existe (requer parâmetros — heurística confirmou)

### ✅ fn:estoque_fn_roi_estoque

Existe (requer parâmetros — heurística confirmou)

### ✅ fn:estoque_chat_contexto

Existe e executa sem parâmetros

### ❌ estoque_config

TABELA VAZIA — popular com B1 de correcoes-sql.sql

### ✅ vw_sugestao_compra

Existe e retorna lec_sugerido (LEC está ativo) — 3 produto(s) classe A

<details><summary>Dados</summary>

```json
[
  {
    "id": "f255c277-b17b-4964-9960-e10434de825a",
    "codigo": "FER-002",
    "nome": "Trilho Romana 1.50m Alumínio",
    "classificacao_abc": "A",
    "quantidade_atual": 0,
    "quantidade_minima": 3,
    "custo_unitario": 120,
    "fornecedor_id": "bc915042-6d7a-4101-af06-b0bf77ba517b",
    "fornecedor_nome": "Distribuidora de Ferragens",
    "prazo_entrega_dias": 7,
    "lec_sugerido": 0,
    "custo_estimado": 0,
    "deficit": 3,
    "urgencia": "critico"
  },
  {
    "id": "4987c264-23a2-4b13-b86b-f389e070a4cb",
    "codigo": "FER-001",
    "nome": "Trilho Rolô 1.20m Branco",
    "classificacao_abc": "A",
    "quantidade_atual": 1.5,
    "quantidade_minima": 5,
    "custo_unitario": 45,
    "fornecedor_id": "bc915042-6d7a-4101-af06-b0bf77ba517b",
    "fornecedor_nome": "Distribuidora de Ferragens",
    "prazo_entrega_dias": 7,
    "lec_sugerido": 0,
    "custo_estimado": 0,
    "deficit": 3.5,
    "urgencia": "abaixo_minimo"
  },
  {
    "id": "ddc9d1e7-80c5-48d3-9741-3ceafa628ce8",
    "codigo": "TCD-005",
    "nome": "Tecido Voil Branco 2.80m",
    "classificacao_abc": "A",
    "quantidade_atual": 2,
    "quantidade_minima": 5,
    "custo_unitario": 35,
    "fornecedor_id": "ac0eca77-535d-4f61-970e-fab1af2a7b59",
    "fornecedor_nome": "Fornecedor Tecidos SP",
    "prazo_entrega_dias": 15,
    "lec_sugerido": 0,
    "custo_estimado": 0,
    "deficit": 3,
    "urgencia": "abaixo_minimo"
  }
]
```

</details>

### ℹ️ estoque_vendas

0 venda(s) registrada(s) no banco

### ℹ️ peps_evidencia

0 item(ns) de lote com quantidade_restante < quantidade original (PEPS ativo)

### ℹ️ abc_classificados

0 produto(s) com classificação ABC definida

### ⚠️ migrations

Requer service key — não verificado (anon key em uso)

---
*Script: `npm run auditoria:estoque:investigar`*
