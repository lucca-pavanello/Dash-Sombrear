# Módulo de Estoque — Fase 4 (Completo)

Módulo de gestão de materiais da Sombrear. Controla entradas de compra, saídas por vendas, custo médio ponderado (CMPC), PEPS (First-In-First-Out), classificação ABC, giro de estoque, Lote Econômico de Compra (LEC) e sugestões automáticas de reposição. Integrado ao dashboard principal via sub-aba **Estoque**.

---

## Comandos de setup

### Rodar as migrations no Supabase

```bash
npx supabase db push
```

Ou aplicar manualmente na ordem:

```bash
npx supabase migration up 0001_estoque_fase1_schema
npx supabase migration up 0002_estoque_fase1_triggers
npx supabase migration up 0003_estoque_fase1_funcao_abc
npx supabase migration up 0004_estoque_fase4_giro_lec
npx supabase migration up 0005_estoque_fase3_config_peps
npx supabase migration up 0006_estoque_fase3_trigger_e_view
```

### Rodar o seed (fornecedores + produtos de exemplo)

No SQL Editor do Supabase Dashboard:

```sql
-- copie e execute o conteúdo de supabase/seed-estoque.sql
```

### Recalcular curva ABC manualmente

```sql
select * from fn_recalcular_abc();
```

Também disponível via botão "Recalcular Curva ABC" no Dashboard de Estoque.

---

## Estrutura de pastas

```
src/
├── components/
│   └── estoque/
│       ├── analises/                   # Fase 4 Trilha A — giro e análises
│       │   ├── AnalisesDashboard.tsx
│       │   ├── GiroCards.tsx
│       │   ├── GiroMensalChart.tsx
│       │   └── GiroTables.tsx
│       ├── dashboard/                  # Dashboard + cards
│       │   ├── CardGiro.tsx            # Fase 4 — giro anual clicável
│       │   ├── CardSemLocalizacao.tsx
│       │   ├── CardSugestoesCompra.tsx # Fase 4 — contagem de sugestões clicável
│       │   ├── CardTecidoParado.tsx
│       │   ├── EstoqueDashboard.tsx
│       │   ├── MetricCard.tsx
│       │   ├── ParetoChart.tsx
│       │   ├── RecalcularABCButton.tsx
│       │   └── TopAClassTable.tsx
│       ├── sugestao/
│       │   └── SugestaoCompraView.tsx  # Fase 4 Trilha B — tabela + CSV por fornecedor
│       ├── ConfiguracaoView.tsx        # Fase 3 + Fase 4 — seções Lead Time + Parâmetros de Compra
│       ├── EntradaRapidaForm.tsx
│       ├── EntradasHistoricoTable.tsx
│       ├── EstoqueProdutosTable.tsx
│       ├── EstoqueAlertasPanel.tsx
│       ├── FornecedoresTable.tsx
│       ├── LeadTimeView.tsx
│       ├── LocalizacoesTable.tsx
│       ├── MoverItensView.tsx
│       ├── NovaLocalizacaoForm.tsx
│       ├── NovaMovimentacaoForm.tsx
│       ├── NovoFornecedorForm.tsx
│       ├── NovoProdutoForm.tsx
│       ├── RegistroVendasView.tsx
│       └── VendaDetalheView.tsx
├── hooks/
│   ├── useEstoqueCategorias.ts
│   ├── useEstoqueConfig.ts             # Fase 3 — lê/salva estoque_config
│   ├── useEstoqueFornecedores.ts
│   ├── useEstoqueLeadTime.ts           # Fase 3 — lead time por produto
│   ├── useEstoqueLotes.ts
│   ├── useEstoqueMovimentacoes.ts
│   ├── useEstoqueProdutos.ts
│   ├── useEstoqueAnalytics.ts          # Fase 4 — giro mensal, pareto, ABC
│   ├── useEstoqueSugestao.ts           # Fase 4 — view sugestão de compra
│   └── useEstoqueSugestoesMover.ts     # Fase 2 — sugestões de reorganização ABC
└── components/tabs/
    └── TabEstoque.tsx                  # Container principal (11 sub-tabs)
```

---

## Tabelas

| Tabela | Descrição |
|---|---|
| `estoque_categorias` | Categorias de produto (Tecidos, Ferragens, Acessórios etc.) |
| `estoque_fornecedores` | Fornecedores com CNPJ, contato e prazo de entrega |
| `estoque_produtos` | Produtos com SKU, unidade, custo médio (CMPC), estoque atual e classe ABC |
| `estoque_lotes` | Cabeçalho de compra: fornecedor, NF, data, valor total |
| `estoque_lote_itens` | Itens de cada lote; triggers atualizam quantidade, custo e PEPS |
| `estoque_movimentacoes` | Trilha de auditoria de todas as movimentações |
| `estoque_localizacoes` | Localizações físicas para organização de produtos |
| `estoque_vendas` | Cabeçalho de venda (cliente, data, total) |
| `estoque_venda_itens` | Itens vendidos; trigger PEPS consome lotes FIFO |
| `estoque_config` | Parâmetros configuráveis (thresholds, LEC) em formato chave/valor |

---

## Views SQL

| View | Descrição |
|---|---|
| `estoque_vw_lead_time` | Dias em estoque por produto (lote mais antigo com saldo) |
| `estoque_vw_sugestao_compra` | Produtos classe A ranqueados por urgência de reposição + LEC |
| `estoque_vw_sugestao_movimentacao` | Produtos mal-alocados segundo posição ABC ideal |

---

## Funções SQL

| Função | Descrição |
|---|---|
| `fn_recalcular_abc()` | Reclassifica todos os produtos em A/B/C/sem_dados |
| `estoque_consumir_peps(produto_id, quantidade)` | Consome lotes em ordem FIFO para saídas |
| `estoque_calcular_giro(p_data_inicio, p_data_fim)` | Retorna giro real/unidades + valor em estoque (padrão: últimos 365 dias) |

---

## Telas (sub-tabs)

| Tela | O que faz |
|---|---|
| **Dashboard** | 8 cards (operacionais + gerenciais), alertas de estoque mínimo, curva ABC Pareto, Top Classe A |
| **Análises** | Cards de giro de estoque, gráfico mensal (12 meses), tabelas por rotatividade |
| **Produtos** | Tabela com filtros; criação e edição via modal |
| **Fornecedores** | Tabela com busca; criação e edição via modal |
| **Entradas** | Formulário de entrada rápida + histórico dos últimos 50 itens |
| **Vendas** | Registro de vendas multi-item + histórico + detalhe por venda |
| **Localizações** | CRUD de localizações físicas com nível de acesso |
| **Mover Itens** | Sugestões de reorganização ABC — confirmar movimentação |
| **Sugestão de Compra** | Produtos classe A ranqueados por urgência; seleção em lote; CSV por fornecedor |
| **Lead Time** | Tabela colorida de dias em estoque por produto |
| **Configurações** | Seções: Lead Time (thresholds) + Parâmetros de Compra (LEC) |

---

## Lógica automática (triggers)

| Trigger | Evento | Efeito |
|---|---|---|
| `trg_lote_item_movimentacao` | INSERT em `estoque_lote_itens` | Cria linha em `estoque_movimentacoes` |
| `trg_mov_estoque` | INSERT em `estoque_movimentacoes` | Incrementa `quantidade_atual` |
| `trg_lote_item_custo_medio` | INSERT em `estoque_lote_itens` | Atualiza custo médio ponderado (CMPC) |
| `trg_lote_atualiza_total` | INSERT/UPDATE em `estoque_lote_itens` | Recalcula `estoque_lotes.valor_total` |
| `trg_venda_item_movimentacao_peps` | INSERT em `estoque_venda_itens` | Chama PEPS → consome lotes FIFO |

---

## Fase 4 — Giro + LEC + Sugestão de Compra ✓

### Giro de Estoque
- `estoque_calcular_giro()` — RPC que retorna giro real (CMV/estoque médio) e giro em unidades
- Sub-tab **Análises**: KPI cards de giro, gráfico de evolução mensal (12 meses), tabelas de baixo/alto giro
- `CardGiro` no dashboard: clicável, navega para Análises

### LEC (Lote Econômico de Compra)
- Calculado na view `estoque_vw_sugestao_compra` usando: custo_pedido, taxa_estocagem, demanda_anual
- Parâmetros configuráveis em **Configurações → Parâmetros de Compra**:
  - `custo_pedido_reais` (padrão: 50)
  - `taxa_custo_estocagem_percent` (padrão: 20)
  - `meses_historico_demanda` (padrão: 12)

### Sugestão de Compra
- View filtra produtos classe A, calcula déficit e urgência (`critico | abaixo_minimo | atencao | ok`)
- Sub-tab **Sugestão de Compra**: filtros, checkbox em lote, exportação CSV por fornecedor (UTF-8 BOM)
- `CardSugestoesCompra` no dashboard: fica vermelho quando há críticos, clicável

---

## Configurações — chaves disponíveis

| Chave | Padrão | Descrição |
|---|---|---|
| `lead_time_verde_max_dias` | 90 | Threshold verde do lead time |
| `lead_time_amarelo_max_dias` | 180 | Threshold amarelo do lead time |
| `custo_pedido_reais` | 50 | Custo médio de emitir um pedido (R$) |
| `taxa_custo_estocagem_percent` | 20 | Taxa anual de custo de estocagem (%) |
| `meses_historico_demanda` | 12 | Janela de histórico para calcular demanda |

---

## Limitações restantes (fora do escopo)

| Funcionalidade | Motivo |
|---|---|
| Previsão de demanda com ML | Requer dados históricos suficientes + modelagem |
| Multi-loja / filiais | Arquitetura de tenant não implementada |
| Integração ERP / NF-e automática | Depende de API fiscal (SEFAZ, etc.) |
| RLS granular por papel | Hoje: permissivo para todos os autenticados |
| Alertas push / notificações | Canal de notificação não configurado |
