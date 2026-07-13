# Módulo de Estoque — Documentação Completa

> Dashboard Sombrear · Stack: React + TypeScript + Supabase + React Query

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Modelo de Dados](#2-modelo-de-dados)
3. [Views e RPCs](#3-views-e-rpcs)
4. [Subtabs e Componentes](#4-subtabs-e-componentes)
5. [Hooks de Dados](#5-hooks-de-dados)
6. [Fórmulas e Cálculos](#6-fórmulas-e-cálculos)
7. [KPIs do Dashboard](#7-kpis-do-dashboard)
8. [Parâmetros de Configuração](#8-parâmetros-de-configuração)
9. [Fluxo de Operações](#9-fluxo-de-operações)

---

## 1. Visão Geral

O módulo de Estoque é uma das abas principais do Dashboard Sombrear. Cobre o ciclo completo de gestão de materiais: cadastro, entradas, saídas, análises ABC, sugestão de compra, alertas de ruptura e analytics financeiros (ROI, capital travado, margem).

**Localização no código:** `src/components/estoque/`  
**Tab principal:** `src/components/tabs/TabEstoque.tsx`  
**Rota:** aba "Estoque" no Dashboard

---

## 2. Modelo de Dados

### 2.1 `estoque_produtos`

Tabela principal. Cada linha é um item de estoque (tecido, ferragem, acessório, etc.).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Nome do produto |
| `codigo` | text \| null | SKU / código interno |
| `categoria_id` | uuid FK | → `estoque_categorias` |
| `unidade` | enum | `'m'`, `'m2'`, `'un'`, `'kg'` |
| `largura_padrao_cm` | numeric \| null | Para tecidos vendidos por metro |
| `quantidade_atual` | numeric | Saldo atual calculado pelas movimentações |
| `quantidade_minima` | numeric | Estoque de segurança / ponto de alerta |
| `custo_unitario` | numeric \| null | Custo médio ponderado (atualizado nas entradas) |
| `preco_venda` | numeric \| null | Preço de venda unitário |
| `fornecedor` | text \| null | Nome livre (legado) |
| `localizacao_id` | uuid \| null | → `estoque_localizacoes` |
| `classificacao_abc` | enum \| null | `'A'`, `'B'`, `'C'`, `'sem_dados'` |
| `ativo` | boolean | Soft-delete |
| `observacoes` | text \| null | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2.2 `estoque_categorias`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Ex.: "Tecido Rolo", "Ferragem Trilho" |
| `tipo` | enum | `'tecido'`, `'acessorio'`, `'ferragem'`, `'outro'` |
| `created_at` | timestamptz | |

### 2.3 `estoque_localizacoes`

Mapa físico do depósito.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `codigo` | text | Ex.: "A-01-03" |
| `setor` | text | Ex.: "Depósito Principal" |
| `prateleira` | text \| null | Letra/número da prateleira |
| `posicao` | text \| null | Posição dentro da prateleira |
| `nivel_acesso` | enum | `'balcao'`, `'acessivel'`, `'medio'`, `'fundo'`, `'deposito'` |
| `descricao` | text \| null | |
| `ativo` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

### 2.4 `estoque_fornecedores`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | |
| `cnpj` | text \| null | |
| `telefone` | text \| null | |
| `email` | text \| null | |
| `contato` | text \| null | Nome do contato |
| `prazo_entrega_dias` | integer \| null | |
| `ativo` | boolean | |
| `observacoes` | text \| null | |
| `created_at` | timestamptz | |

### 2.5 `fornecedor_categorias`

Tabela de categorias de produtos por fornecedor (ex.: Fornecedor X fornece Tecido com lead time de 7 dias).

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `fornecedor_id` | uuid FK |
| `tipo_produto` | `'Tecido'` \| `'Ferragem'` \| `'Acessorio'` |
| `lead_time_dias` | integer |
| `prazo_pagamento_dias` | integer \| null |
| `observacao` | text \| null |
| `ativo` | boolean |

### 2.6 `fornecedor_desconto_combo`

Descontos concedidos pelo fornecedor ao pedir múltiplas categorias juntas.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `fornecedor_id` | uuid FK |
| `categorias_combo` | text[] | Array de tipos de produto |
| `percentual_desconto` | numeric |
| `valor_minimo_pedido` | numeric \| null |
| `observacao` | text \| null |
| `ativo` | boolean |

### 2.7 `estoque_movimentacoes`

Livro de movimentações. Nunca deletar — é a fonte da verdade do saldo.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK | |
| `tipo` | enum | `'entrada'`, `'saida'`, `'ajuste'`, `'perda'` |
| `quantidade` | numeric | Valor positivo sempre (direção dada pelo `tipo`) |
| `quantidade_anterior` | numeric | Saldo antes desta movimentação |
| `orcamento_id` | uuid \| null | Vínculo opcional com orçamento |
| `motivo` | text \| null | |
| `nota_fiscal` | text \| null | |
| `custo_unitario` | numeric \| null | Custo na entrada (para cálculo de custo médio) |
| `responsavel` | text | Nome de quem registrou |
| `user_id` | uuid \| null | |
| `created_at` | timestamptz | |

### 2.8 `estoque_lotes`

Representa uma nota fiscal de entrada (um lote pode conter vários produtos).

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `fornecedor_id` | uuid \| null |
| `nf_numero` | text \| null |
| `data_entrada` | date |
| `valor_total` | numeric |
| `observacoes` | text \| null |
| `user_id` | uuid \| null |
| `created_at` | timestamptz |

### 2.9 `estoque_lote_itens`

Itens de um lote.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `lote_id` | uuid FK |
| `produto_id` | uuid FK |
| `quantidade` | numeric |
| `custo_unitario` | numeric |

### 2.10 `estoque_vendas` + `estoque_venda_itens`

Registro de vendas diretas (fora do fluxo de orçamentos).

**`estoque_vendas`:**

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `data` | date |
| `cliente` | text \| null |
| `total` | numeric |
| `vendedor_id` | uuid \| null |
| `observacao` | text \| null |
| `created_at` | timestamptz |

**`estoque_venda_itens`:**

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `venda_id` | uuid FK |
| `produto_id` | uuid FK |
| `quantidade` | numeric |
| `preco_unitario` | numeric |
| `desconto` | numeric |
| `subtotal` | numeric |

---

## 3. Views e RPCs

### Views (SELECT-only)

| View | Descrição |
|---|---|
| `estoque_produtos_alerta` | Produtos com `quantidade_atual < quantidade_minima` (JOIN com `estoque_categorias`) |
| `estoque_vw_ponto_pedido` | Por produto: demanda diária, lead time, estoque de segurança, ponto de pedido calculado, cobertura em dias, `nivel_alerta` |
| `estoque_vw_cobertura_margem` | Por produto: consumo 90 dias, cobertura em dias, margem percentual |

### RPCs (funções Postgres)

| RPC | Parâmetros | Retorno |
|---|---|---|
| `top_produtos_movimentados` | `p_limit integer` | `[{produto_id, nome, total_saidas, total_entradas}]` |
| `fn_recalcular_abc` | — | void (atualiza `classificacao_abc` em `estoque_produtos`) |
| `estoque_fn_roi_estoque` | — | `[{lucro_bruto_90d, lucro_bruto_anualizado, valor_estoque_atual, roi_percentual}]` |
| `estoque_fn_capital_travado` | `p_dias_minimos integer` | `[{total_produtos, total_capital_reais, por_classe}]` |

### Sugestão de Compra

Calculada client-side pelo hook `useEstoqueSugestao`. Retorna `SugestaoCompra[]`:

| Campo | Tipo |
|---|---|
| `id` | uuid |
| `codigo` | text \| null |
| `nome` | text |
| `classificacao_abc` | string |
| `quantidade_atual` | number |
| `quantidade_minima` | number |
| `custo_unitario` | number \| null |
| `fornecedor_id` | uuid \| null |
| `fornecedor_nome` | string \| null |
| `prazo_entrega_dias` | number \| null |
| `lec_sugerido` | number |
| `custo_estimado` | number |
| `deficit` | number |
| `urgencia` | `'critico'` \| `'abaixo_minimo'` \| `'atencao'` \| `'ok'` |

---

## 4. Subtabs e Componentes

O módulo é organizado em subtabs dentro de `TabEstoque.tsx`:

| Subtab | Componente principal | Descrição |
|---|---|---|
| `visao-geral` | `EstoqueKPIGrid` + `EstoqueAlertasPanel` | KPIs gerais + alertas de baixo estoque |
| `produtos` | `EstoqueProdutosTable` | CRUD de produtos, filtros, paginação, export CSV/XLSX |
| `entradas` | `EntradasHistoricoTable` + `EntradaRapidaForm` | Histórico de entradas + formulário rápido de entrada |
| `movimentacoes` | `EstoqueMovimentacoesTable` + `NovaMovimentacaoForm` | Todas as movimentações (entrada/saída/ajuste/perda) |
| `lotes` | `LotesTable` + `NovoLoteForm` | Notas fiscais de entrada com múltiplos produtos |
| `vendas` | `RegistroVendasView` + `VendaDetalheView` | Registro de vendas diretas |
| `fornecedores` | `FornecedoresTable` | CRUD de fornecedores, paginação, export CSV/XLSX |
| `localizacoes` | `LocalizacoesTable` | CRUD de localizações do depósito, paginação, export |
| `alertas` | `EstoqueAlertasPanel` | Produtos abaixo do mínimo agrupados por categoria |
| `ponto-pedido` | `PontoPedidoView` | Tabela com ponto de pedido, cobertura e nível de alerta |
| `analises` | `AnalisesView` + `AbcCurveChart` | Curva ABC, top movimentados, gráficos mensais |
| `acoes` | `AcoesView` | Sugestão de compra (LEC) + sugestão de mover itens |
| `configuracao` | `ConfiguracaoView` | Parâmetros globais do módulo |

### Paginação das tabelas

`EstoqueProdutosTable`, `FornecedoresTable` e `LocalizacoesTable` implementam paginação client-side com `PAGE_SIZE = 50`. O state `page` é resetado via `useEffect` ao mudar filtros.

### Export CSV/XLSX

Botões disponíveis nas 3 tabelas acima. Utilizam `src/lib/exportUtils.ts`:
- `exportCsv(filename, rows)` — BOM UTF-8 + download via Blob
- `exportXlsx(filename, rows)` — via biblioteca `xlsx` (SheetJS)

**Colunas exportadas por tabela:**

| Tabela | Colunas |
|---|---|
| Produtos | Nome, SKU, Categoria, Localização, Estoque Atual, Estoque Mín, Custo Médio, Preço Venda, Unidade, Ativo |
| Fornecedores | Nome, Contato, Email, Telefone, CNPJ, Prazo Entrega, Ativo |
| Localizações | Código, Setor, Prateleira, Posição, Nível de Acesso, Nº Produtos, Ativo |

---

## 5. Hooks de Dados

| Hook | Arquivo | Consulta |
|---|---|---|
| `useEstoqueProdutos` | `useEstoqueProdutos.ts` | `estoque_produtos` + JOIN `estoque_categorias` |
| `useEstoqueProdutosAlerta` | `useEstoqueProdutos.ts` | view `estoque_produtos_alerta` |
| `useCreateEstoqueProduto` | `useEstoqueProdutos.ts` | INSERT |
| `useUpdateEstoqueProduto` | `useEstoqueProdutos.ts` | UPDATE |
| `useEstoqueCategorias` | `useEstoqueCategorias.ts` | `estoque_categorias` |
| `useEstoqueLocalizacoes` | `useEstoqueLocalizacoes.ts` | `estoque_localizacoes` |
| `useEstoqueFornecedores` | `useEstoqueFornecedores.ts` | `estoque_fornecedores` |
| `useEstoqueMovimentacoes` | `useEstoqueMovimentacoes.ts` | `estoque_movimentacoes` com filtros |
| `useEstoqueLotes` | `useEstoqueLotes.ts` | `estoque_lotes` + `estoque_lote_itens` |
| `useEstoqueVendas` | `useEstoqueVendas.ts` | `estoque_vendas` + `estoque_venda_itens` |
| `useTopProdutosMovimentados` | `useEstoqueAnalytics.ts` | RPC `top_produtos_movimentados` |
| `useCurvaAbc` | `useEstoqueAnalytics.ts` | `estoque_produtos` + movimentações 90d |
| `useRecalcularAbc` | `useEstoqueAnalytics.ts` | RPC `fn_recalcular_abc` |
| `useEstoquePontoPedido` | `useEstoquePontoPedido.ts` | view `estoque_vw_ponto_pedido` |
| `useEstoqueSugestao` | `useEstoqueSugestao.ts` | Calculado client-side (LEC) |
| `useEstoqueSugestoesMover` | `useEstoqueSugestoesMover.ts` | Sugestão de realocação por classe ABC |
| `useCoberturaEstoque` | `useEstoqueCoberturaEstoque.ts` | view `estoque_vw_cobertura_margem` (order: cobertura_dias ASC) |
| `useMargemEstoque` | `useEstoqueMargemEstoque.ts` | view `estoque_vw_cobertura_margem` (order: margem_percentual DESC) |
| `useROIEstoque` | `useEstoqueROI.ts` | RPC `estoque_fn_roi_estoque` |
| `useCapitalTravado` | `useEstoqueCapitalTravado.ts` | RPC `estoque_fn_capital_travado` |
| `useEstoqueLeadTime` | `useEstoqueLeadTime.ts` | Histórico de lead time por fornecedor/produto |
| `useEstoqueConfig` | `useEstoqueConfig.ts` | `estoque_config` (parâmetros globais) |
| `useEstoqueAnalyticsDescritivo` | `useEstoqueAnalyticsDescritivo.ts` | Estatísticas descritivas (média, desvio-padrão) |

---

## 6. Fórmulas e Cálculos

### 6.1 Custo Médio Ponderado (CMP)

Recalculado em cada entrada:

```
Novo CMP = (Estoque Anterior × CMP Anterior + Quantidade Entrada × Custo Entrada)
           ──────────────────────────────────────────────────────────────────────
                    Estoque Anterior + Quantidade Entrada
```

### 6.2 Classificação ABC (Pareto por valor monetário)

Executada via `fn_recalcular_abc()`. Ordena produtos por `valor_saidas_90d = saídas nos últimos 90d × custo_unitario`:

| Classe | Regra de corte |
|---|---|
| **A** | Primeiros produtos que acumulam ≥ 80% do valor total |
| **B** | Próximos que acumulam até 95% |
| **C** | Restantes (últimos 5%) |
| **sem_dados** | Produto sem saídas ou sem custo nos 90 dias |

### 6.3 Ponto de Pedido (PP)

```
PP = Demanda Diária × (Lead Time + Dias de Estoque de Segurança)
```

Onde:
- **Demanda diária** = total de saídas 90 dias ÷ 90
- **Lead time** = `prazo_entrega_dias` do fornecedor principal (tabela `fornecedor_categorias`)
- **Estoque de segurança** = parâmetro de configuração `estoque_seguranca_dias`

### 6.4 Cobertura de Estoque

```
Cobertura (dias) = Estoque Atual ÷ Demanda Diária
```

`null` quando `demanda_diaria = 0` (produto sem saídas nos últimos 90 dias).

### 6.5 Lote Econômico de Compra (LEC)

Fórmula de Wilson:

```
LEC = √( 2 × D × S / H )
```

Onde:
- **D** = demanda anual = demanda diária × 365
- **S** = custo de pedido = parâmetro `custo_pedido` (configuração)
- **H** = custo de manutenção anual = `custo_unitario × taxa_manutencao` (configuração)

Resultado arredondado para inteiro. Usado na coluna `lec_sugerido` de `SugestaoCompra`.

### 6.6 Déficit de Estoque

```
Déficit = max(0, quantidade_minima - quantidade_atual)
```

### 6.7 Custo Estimado de Reposição

```
Custo Estimado = max(LEC, Déficit) × custo_unitario
```

### 6.8 Urgência de Compra

| Nível | Condição |
|---|---|
| `critico` | `quantidade_atual = 0` |
| `abaixo_minimo` | `quantidade_atual < quantidade_minima` |
| `atencao` | `quantidade_atual < quantidade_minima × 1.5` |
| `ok` | Demais casos |

### 6.9 Margem Bruta por Produto

```
Margem (%) = (preco_venda - custo_medio) / preco_venda × 100
```

`null` se `preco_venda` ou `custo_medio` for nulo ou `preco_venda = 0`.

### 6.10 ROI do Estoque

Calculado pela RPC `estoque_fn_roi_estoque`:

```
Lucro Bruto 90d         = Σ (preco_unitario - custo_unitario) × quantidade  [saídas 90d com custo]
Lucro Bruto Anualizado  = Lucro Bruto 90d × (365 / 90)
Valor Estoque Atual     = Σ quantidade_atual × custo_unitario
ROI (%)                 = Lucro Bruto Anualizado / Valor Estoque Atual × 100
```

### 6.11 Capital Travado

Calculado pela RPC `estoque_fn_capital_travado(p_dias_minimos)`:

Retorna o valor imobilizado em produtos com cobertura acima de `p_dias_minimos` (padrão 90 dias), agrupado por classe ABC.

```
Capital Travado = Σ quantidade_atual × custo_unitario   [para produtos com cobertura > p_dias_minimos]
```

### 6.12 Giro de Estoque

```
Giro = Custo das Vendas (90d) / Valor Médio do Estoque (90d)
```

Calculado client-side em `useEstoqueAnalyticsDescritivo`.

### 6.13 Nível de Alerta (Ponto de Pedido)

| Nível | Condição |
|---|---|
| `ruptura` | `estoque_atual = 0` |
| `critico` | `estoque_atual ≤ ponto_pedido × 0.5` |
| `atencao` | `estoque_atual ≤ ponto_pedido` |
| `ok` | `estoque_atual > ponto_pedido` |
| `sem_dados` | Sem lead time ou sem demanda registrada |

---

## 7. KPIs do Dashboard

Exibidos em `EstoqueKPIGrid`:

| KPI | Fórmula / Fonte |
|---|---|
| **Total em Estoque** | `Σ quantidade_atual` de produtos ativos |
| **Valor do Estoque** | `Σ quantidade_atual × custo_unitario` |
| **Produtos Ativos** | `COUNT` de produtos com `ativo = true` |
| **Produtos em Alerta** | `COUNT` de produtos com `quantidade_atual < quantidade_minima` |
| **Cobertura Média** | Média de `cobertura_dias` dos produtos ativos (view `estoque_vw_cobertura_margem`) |
| **Margem Média** | Média de `margem_percentual` dos produtos com preço de venda cadastrado |
| **ROI do Estoque** | `roi_percentual` da RPC `estoque_fn_roi_estoque` |
| **Capital Travado** | `total_capital_reais` da RPC `estoque_fn_capital_travado` |
| **Entradas (30d)** | `COUNT + SUM(quantidade)` de movimentações tipo `entrada` nos últimos 30 dias |
| **Saídas (30d)** | `COUNT + SUM(quantidade)` de movimentações tipo `saida` nos últimos 30 dias |

---

## 8. Parâmetros de Configuração

Gerenciados via `ConfiguracaoView` e hook `useEstoqueConfig`. Salvos na tabela `estoque_config`.

| Parâmetro | Descrição | Padrão |
|---|---|---|
| `estoque_seguranca_dias` | Dias de segurança no cálculo do Ponto de Pedido | 7 |
| `custo_pedido` | Custo fixo por pedido de compra (R$) — usado no LEC | 50 |
| `taxa_manutencao` | Taxa anual de manutenção do estoque (%) — usado no LEC | 0.25 (25%) |
| `dias_analise_abc` | Janela em dias para recalcular a curva ABC | 90 |
| `dias_capital_travado` | Cobertura mínima (dias) para considerar capital travado | 90 |

---

## 9. Fluxo de Operações

### Entrada de Produto (fluxo simplificado)

```
Usuário preenche EntradaRapidaForm
    → useCreateEstoqueMovimentacao (tipo='entrada')
    → INSERT estoque_movimentacoes
    → Trigger Postgres atualiza estoque_produtos.quantidade_atual
    → Trigger recalcula custo_unitario (CMP)
    → React Query invalida ['estoque-produtos'] + ['estoque-movimentacoes']
```

### Entrada por Lote (NF)

```
Usuário preenche NovoLoteForm (fornecedor + NF + itens)
    → useCreateEstoqueLote
    → INSERT estoque_lotes + estoque_lote_itens
    → Trigger Postgres cria movimentações tipo='entrada' para cada item
    → Trigger atualiza quantidade_atual + custo médio
    → React Query invalida ['estoque-lotes'] + ['estoque-produtos']
```

### Saída / Consumo

```
Usuário registra em NovaMovimentacaoForm (tipo='saida' ou 'perda')
    → INSERT estoque_movimentacoes
    → Trigger decrementa estoque_produtos.quantidade_atual
    → Se quantidade_atual < quantidade_minima → produto aparece em estoque_produtos_alerta
```

### Recalcular ABC

```
Usuário clica "Recalcular ABC" em AnalisesView
    → useRecalcularAbc.mutate()
    → RPC fn_recalcular_abc() — classifica produtos por valor de saída 90d (Pareto 80/15/5)
    → React Query invalida ['estoque-produtos']
    → Curva ABC atualizada em AbcCurveChart
```

### Sugestão de Compra (LEC)

```
useEstoqueSugestao (client-side)
    → Carrega estoque_produtos ativos com quantidade_atual < quantidade_minima × 1.5
    → Para cada produto:
        demanda_diaria = saidas_90d / 90
        D = demanda_diaria × 365
        LEC = √(2DS/H)
        deficit = max(0, qtd_min - qtd_atual)
        custo_estimado = max(LEC, deficit) × custo_unitario
    → Ordena por urgência (critico → abaixo_minimo → atencao)
    → Exibe em AcoesView com botão "Gerar Pedido"
```

---

*Documento gerado em 2026-04-16. Atualizar ao adicionar novas tabelas, views ou cálculos ao módulo.*
