# Módulo de Estoque — Fase 1

Módulo de gestão de materiais da Sombrear. Controla entradas de compra, saídas por vendas, custo médio ponderado e classificação ABC dos produtos. Integrado ao dashboard principal via sub-aba **Estoque**.

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
```

### Rodar o seed (fornecedores + 10 produtos de exemplo)

No SQL Editor do Supabase Dashboard (projeto `nlswyjpjzibuvdsaooyg`):

```sql
-- copie e execute o conteúdo de supabase/seed-estoque.sql
```

Ou via CLI:

```bash
npx supabase db reset  # CUIDADO: apaga dados existentes
```

### Recalcular curva ABC manualmente (SQL)

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
│       ├── dashboard/                  # Trilha C — dashboard e curva ABC
│       │   ├── EstoqueDashboard.tsx
│       │   ├── MetricCard.tsx
│       │   ├── ParetoChart.tsx
│       │   ├── RecalcularABCButton.tsx
│       │   └── TopAClassTable.tsx
│       ├── EntradaRapidaForm.tsx       # Trilha A — form de entrada
│       ├── EntradasHistoricoTable.tsx  # Trilha A — histórico flat
│       ├── EstoqueProdutosTable.tsx    # Tabela de produtos com filtros
│       ├── FornecedoresTable.tsx       # Tabela de fornecedores
│       ├── LotesTable.tsx              # Lotes multi-produto (legado)
│       ├── NovaMovimentacaoForm.tsx    # Form de movimentação avulsa
│       ├── NovoFornecedorForm.tsx      # Form de fornecedor
│       ├── NovoLoteForm.tsx            # Form de lote multi-produto (legado)
│       ├── NovoProdutoForm.tsx         # Form de produto
│       ├── RegistroVendasView.tsx      # View de registro de vendas
│       └── VendaDetalheView.tsx        # Detalhe de venda
├── hooks/
│   ├── useEstoqueCategorias.ts
│   ├── useEstoqueFornecedores.ts
│   ├── useEstoqueLotes.ts
│   ├── useEstoqueMovimentacoes.ts
│   ├── useEstoqueProdutos.ts
│   ├── useEstoqueAnalytics.ts
│   └── useEstoqueVendas.ts
└── components/tabs/
    └── TabEstoque.tsx                  # Container principal (sub-tabs)
```

---

## Tabelas

| Tabela | Descrição |
|---|---|
| `estoque_categorias` | Categorias de produto (Tecidos, Ferragens, Acessórios etc.) com campo `tipo` |
| `estoque_fornecedores` | Fornecedores ativos com CNPJ, contato e prazo de entrega |
| `estoque_produtos` | Produtos com SKU, unidade, custo médio (calculado), estoque atual (calculado) e classe ABC |
| `estoque_lotes` | Cabeçalho de compra: fornecedor, NF, data, valor total (calculado por trigger) |
| `estoque_lote_itens` | Itens de cada lote; ao inserir, triggers atualizam `quantidade_atual` e `custo_unitario` |
| `estoque_movimentacoes` | Trilha de auditoria de todas as movimentações (entrada, saída, ajuste, perda) |
| `estoque_localizacoes` | Localizações físicas da loja (setor, prateleira, nível de acesso) para organização de produtos |

---

## Telas (sub-tabs)

| Tela | O que faz |
|---|---|
| **Dashboard** | KPIs de estoque, painel de alertas de estoque mínimo, curva ABC (gráfico de Pareto) e tabela Top Classe A |
| **Produtos** | Tabela de produtos com filtros por tipo, classe ABC e inativos; criação e edição via modal |
| **Fornecedores** | Tabela de fornecedores com busca; criação e edição inline via modal |
| **Entradas** | Formulário rápido de registro de entrada (single-product); histórico dos últimos 50 itens de entrada |
| **Vendas** | Registro de vendas com saída de estoque; histórico de vendas com detalhe por venda |
| **Localizações** | CRUD de localizações físicas com nível de acesso e contagem de produtos alocados |
| **Mover Itens** | Sugestões de reorganização ABC — produtos mal-alocados com ação para confirmar movimentação |

---

## Lógica automática (triggers)

Ao inserir em `estoque_lote_itens`:
- `trg_lote_item_movimentacao` → cria linha em `estoque_movimentacoes`
- `trg_mov_estoque` → incrementa `estoque_produtos.quantidade_atual`
- `trg_lote_item_custo_medio` → atualiza custo médio ponderado
- `trg_lote_atualiza_total` → recalcula `estoque_lotes.valor_total`

---

## Fase 3 — PEPS + Lead Time + Configurações ✓

### PEPS (First-In-First-Out)
- `estoque_lote_itens.quantidade_restante` rastreia quanto de cada lote ainda está disponível
- `estoque_consumir_peps(produto_id, quantidade)` — função PL/pgSQL que consome lotes na ordem FIFO
- `trg_venda_item_movimentacao_peps` — trigger que chama PEPS ao registrar item de venda

### Lead Time
- View `estoque_vw_lead_time` — dias parados por produto (data do lote mais antigo com saldo)
- Sub-tab **Lead Time** com tabela colorida: verde ≤ 90 dias, amarelo 90–180, vermelho > 180
- Card **"Tecido parado"** no dashboard com alerta vermelho quando há produtos críticos

### Configurações
- Tabela `estoque_config` (chave/valor) com thresholds configuráveis
- Sub-tab **Configurações**: formulário em seções extensíveis para editar parâmetros
- Chaves: `lead_time_verde_max_dias` (90), `lead_time_amarelo_max_dias` (180)

---

## Limitações conhecidas (fases futuras)

| Funcionalidade | Fase planejada |
|---|---|
| Giro de estoque, estoque médio e LEC (Lote Econômico de Compra) | Fase 4 ✓ |
| RLS refinado por papel de usuário (hoje é permissivo para autenticados) | Fase futura |
