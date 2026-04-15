# Auditoria do Módulo de Estoque — 2026-04-15

## Resumo

- ✅ 20 verificações OK
- ⚠️ 5 avisos
- ❌ 3 erros

## Detalhes

### ✅ Tabela estoque_produtos

0 registros, colunas OK

### ✅ Tabela estoque_fornecedores

0 registros, colunas OK

### ✅ Tabela estoque_localizacoes

0 registros, colunas OK

### ✅ Tabela estoque_lotes

0 registros, colunas OK

### ✅ Tabela estoque_vendas

0 registros, colunas OK

### ✅ Tabela estoque_venda_itens

0 registros, colunas OK

### ✅ Tabela estoque_movimentacoes

0 registros, colunas OK

### ✅ Tabela estoque_config

0 registros, colunas OK

### ⚠️ Tabela estoque_fornecedor_categorias

Não existe (opcional — migration pendente): Could not find the table 'public.estoque_fornecedor_categorias' in the schema cache

### ⚠️ Tabela estoque_fornecedor_descontos_combo

Não existe (opcional — migration pendente): Could not find the table 'public.estoque_fornecedor_descontos_combo' in the schema cache

### ✅ View estoque_vw_lead_time

Retorna 17 linhas

### ✅ View estoque_vw_sugestao_compra

Retorna 8 linhas

### ✅ View estoque_vw_sugestao_movimentacao

Retorna 2 linhas

### ⚠️ View estoque_vw_fornecedor_lead_time_efetivo

Não existe (opcional): Could not find the table 'public.estoque_vw_fornecedor_lead_time_efetivo' in the schema cache

### ✅ Função estoque_recalcular_abc

Existe e executa sem parâmetros

### ❌ Função estoque_consumir_peps

Função não existe no banco

### ✅ Função estoque_calcular_giro

Existe e executa sem parâmetros

### ❌ Função estoque_calcular_lec

Função não existe no banco

### ✅ Função estoque_chat_contexto

Existe e executa sem parâmetros

### ⚠️ Função estoque_calcular_desconto_combo

Não existe (opcional — migration pendente)

### ⚠️ Triggers

Não foi possível listar via RPC (Could not find the function public.exec_sql(sql) in the schema cache). Verifique manualmente no SQL Editor do Supabase.

### ✅ Produtos sem fornecedor

0 produto(s) ativo(s) sem fornecedor cadastrado

### ✅ Produtos sem localização

0 produto(s) ativo(s) sem localização

### ✅ Produtos sem custo

0 produto(s) ativo(s) com custo_unitario zero ou null

### ✅ Produtos sem classe ABC

0 produto(s) sem classificação (rodar estoque_recalcular_abc)

### ✅ Lotes com quantidade negativa

0 lote(s) com qtd negativa (possível bug no PEPS)

### ✅ Vendas sem itens

0 venda(s) sem itens (possível lixo de teste)

### ❌ Config Estoque

Nenhuma config encontrada na tabela estoque_config


---
*Gerado automaticamente por `npm run auditoria:estoque`*
