# EXTRAÇÃO COMPLETA — DASH SOMBREAR

Gerado em 2026-04-28 a partir de `C:\Users\Usuario\Dash-Sombrear` (branch `main`, commit `cad227c`).

> **NOTA SOBRE O SCRIPT ORIGINAL** — o prompt em `prompt-extracao-completa-sombrear.txt` foi escrito assumindo Next.js (`next.config.*`, `src/middleware.ts`, `src/pages/api/...`). Este projeto é **Vite + React Router**, então alguns comandos do script não retornam nada. Também o `curl` no Windows-MSYS estava falhando com `CRYPT_E_NO_REVOCATION_CHECK` ao chamar a Management API do Supabase — fix: usar `--ssl-no-revoke`. Esse foi o erro que travou as queries da Parte 2 quando rodadas direto.

---

## 1. STACK E CONFIG

- **Build**: Vite 6 + React 19 + TS 5.8 (sem Next.js, sem SSR)
- **Roteamento**: react-router-dom v7, BrowserRouter com SPA rewrite no Vercel (`vercel.json`)
- **Estado/Data**: TanStack Query v5, Zustand v5
- **UI**: Tailwind 3 (tema laranja Sombrear `#E8701A`), shadcn primitives via `@radix-ui/*`
- **Charts/PDF/XLSX**: recharts, jspdf+autotable, xlsx, html2canvas
- **DB**: Supabase JS v2.50
- **Deploy**: Vercel (`https://dash-sombrear.vercel.app`)
- **GitHub**: `https://github.com/luccapa-pav/Dash-Sombrear`
- **Aliases**: `@/*` → `./src/*` (vite.config.ts)
- **Manual chunks**: vendor-react, vendor-query, vendor-supabase, vendor-charts, vendor-xlsx, vendor-pdf, vendor-canvas
- **Headers Vercel**: X-Content-Type-Options=nosniff, X-Frame-Options=DENY, Permissions-Policy bloqueia camera/mic/geo
- **Build status**: `npm run build` passou em 15.69s (chunk maior é TabEstoque a 528 KB)

### Scripts (`package.json`)
```
dev: vite
build: tsc -b && vite build
preview: vite preview
lint: eslint .
auditoria:estoque: tsx scripts/auditoria-estoque.ts
auditoria:estoque:investigar: tsx scripts/investigacao-sql.ts
```

### Variáveis de ambiente (`.env`)
- `VITE_SUPABASE_URL` (público)
- `VITE_SUPABASE_ANON_KEY` (publishable, RLS protege o banco)
- `VITE_FEATURE_AI_ESTOQUE` (feature flag do chat IA do estoque)
- `VITE_GOOGLE_SHEETS_ID` / `VITE_GOOGLE_SHEETS_GID`
- (server-side, nas Edge Functions) `GEMINI_API_KEY`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. ÁRVORE DO PROJETO

```
src/
├── App.tsx                    # BrowserRouter + auth gating + ErrorBoundary
├── main.tsx
├── index.css
├── vite-env.d.ts
├── components/
│   ├── admin/                 # PainelAdmin, PermissoesView
│   ├── charts/                # ModelosChart, ResponsavelChart
│   ├── custos/                # (cálculo de custo interno)
│   ├── estoque/               # Módulo estoque completo
│   │   ├── chat/              # Chat IA (function-calling Gemini)
│   │   │   ├── ChatDrawer.tsx ChatInput.tsx ChatMessage.tsx
│   │   │   ├── ChatSugestoes.tsx ChatTrigger.tsx
│   │   │   ├── ConfirmacaoAcao.tsx
│   │   │   ├── executors.ts          # implementação das 14 tools
│   │   │   ├── featureFlag.ts
│   │   │   ├── store.ts              # zustand
│   │   │   ├── systemPrompt.ts       # prompt + injeção de snapshot
│   │   │   ├── tools.ts              # TOOLS_GEMINI + NIVEIS_CONFIRMACAO
│   │   │   ├── types.ts useChat.ts useChatAPI.ts
│   │   ├── shared/            # ClasseABC, EstoqueTable, FilterPopover, FiltrosAtivosChips, SectionCard, tableStyles, useChartColors
│   │   ├── analises/          # views de análise descritiva
│   │   ├── sugestao/          # sugestão de compra/movimentação
│   │   ├── (Acoes/Analises/Configuracao/EntradaRapida/MoverItens/Localizacoes/Fornecedores/Lotes/Vendas/PontoPedido) View+Form+Table
│   │   └── theme.ts README.md
│   ├── kanban/
│   ├── orcamentos/            # KPIGrid, FiltersBar, OrcamentosTable, EditOrcamentoForm, NovoOrcamentoForm, OrcamentosFechadosCard, RankingResponsavel
│   ├── profile/
│   ├── shared/                # AICopilot, AvatarInitials, ChartTooltip, CommandPalette, EmptyState, ErrorBoundary, GlobalStatusBar, KpiCard, PresentationMode, SectionDivider, SkeletonCard, Sparkline, TopLoadingBar
│   ├── tabs/                  # TabAgenteIA, TabAnalises, TabCalculoCusto, TabCotacao, TabEstoque, TabKanban, TabOrcamentos, TabPlanilha, TabPlanilhaCusto
│   └── ui/
├── hooks/                     # useProfile, useOrcamentos, useAgenteIA, useEstoque*, useGemini, useKanban, useToast, useTheme, usePresence, useScrollReveal, useUiSound, useCommandPalette, useCountUp, useDebounce, usePeriodFilter, useModelosTecidos, useFornecedor*, useCustosInternos, useAddCustoInterno
├── lib/                       # supabase.ts (client + types), constants.ts, exportUtils.ts, utils.ts, analytics.ts, haptic.ts
└── pages/                     # Dashboard, HomePage, Login, OrcamentoPublico, ResetPassword
supabase/
├── functions/                 # create-user, gemini-chat, gemini-estoque, n8n-cotacao
├── migrations/                # 0001..0011 (schema do estoque)
├── migration_kanban_share.sql
├── n8n_novo_cadastro.json
├── seed-estoque.sql
├── setup_estoque.sql / setup_orcamentos.sql / setup_profiles.sql / setup_webhook_n8n.sql
```

---

## 3. ROTEAMENTO E AUTENTICAÇÃO

`App.tsx`:
- Espera `supabase.auth.getSession()` com timeout de 5s
- Rotas públicas: `/orcamento/:id` (OrcamentoPublico), `/login`, `/reset-password`
- Restantes exigem `session`. Após login, `useProfile()` carrega o profile; se `approved !== true` → tela "Aguardando aprovação" com botão de logout
- Quando aprovado: `<Routes>` com `/` → HomePage e `/*` → Dashboard

`HomePage.tsx`: 3 cards (Orçamento / Estoque / Admin) gateadados por:
- `isAdmin = email === ADMIN_EMAIL || profile.is_admin`
- `canOrcamento = isAdmin || profile.pode_orcamento`
- `canEstoque = isAdmin || profile.pode_estoque || email === ESTOQUE_EMAIL`

`Dashboard.tsx`: tabs com lazy-load — `TabOrcamentos`, `TabPlanilha`, `TabAgenteIA`, `TabCotacao`, `TabCalculoCusto`, `TabAnalises`, `TabEstoque`, `PainelAdmin`, `PermissoesView`. Tab válida vem da URL (`VALID_TABS`). Inclui presença real-time, CommandPalette (Cmd+K), ChatStore do estoque, splash, top loading bar, tab indicator animado.

---

## 4. SCHEMA SUPABASE — `public`

Project ref: `nlswyjpjzibuvdsaooyg` · URL: `https://nlswyjpjzibuvdsaooyg.supabase.co` · Region: South America (São Paulo)

### 4.1 Tabelas (RLS = ON em todas)

| tabela | colunas-chave |
|---|---|
| `profiles` | id (uuid PK = auth.users.id), email, full_name, approved (bool null=pendente), is_admin (bool), pode_orcamento (bool), pode_estoque (bool), created_at |
| `orcamentos` | id, created_at, responsavel, cliente, largura, altura, modelo, tecido, quantidade, cor_ferragem_motor, acabamentos, valor_venda, custo_tecido, custo_acabamento, custo_m2, margem, user_id, observacoes, fonte, fechado, telefone, instalacao, **custo_total** (existe — memória estava desatualizada), ambiente, email, validade, status, updated_at |
| `orcamento_historico` | id, orcamento_id (FK), changed_at, changed_by, snapshot (jsonb) |
| `custos_internos` | id, created_at, responsavel, cliente, modelo NOT NULL, tecido, largura, altura, quantidade, cor_ferragem_motor, acabamentos, custo_material, custo_m2, custo_acabamento, custo_instalacao, ambiente, fonte |
| `crm_sombrear_ia` | id, created_at, identificador_usuario NOT NULL, whatsapp NOT NULL, nome, inicio_atendimento, status_lead, resumo_conversa, ultimo_valor_cotado, endereco_cep, data_medicao_instalacao, timestamp_ultima_msg, ids_chatwoot (4), modelo_interesse, ambiente, medidas_coletadas, quantidade, tecido_cor, acabamento_desejado, precisa_instalacao |
| `orcamentos_sombrear_ia` | id, cliente_id (FK→crm_sombrear_ia), created_at, modelo, ambiente, largura, altura, quantidade, tecido, acabamento, custo_total_base, custo_acabamento_total, valor_venda_total_base, valor_venda_acabamento_total, valor_colocacao, resumo_calculo, identificador_whats |
| `n8n_chat_histories` | id (int), session_id, message (jsonb) |
| `estoque_categorias` | id, nome, tipo (`tecido`/`acessorio`/`ferragem`/`outro`) |
| `estoque_produtos` | id, nome NOT NULL, codigo, categoria_id (FK), unidade, largura_padrao_cm, quantidade_atual, quantidade_minima, custo_unitario, fornecedor (texto, **não FK**), ativo, observacoes, classificacao_abc (`A`/`B`/`C`/`sem_dados`), preco_venda, localizacao_id (FK), created/updated_at |
| `estoque_localizacoes` | id, codigo NOT NULL, setor NOT NULL, prateleira, posicao, **nivel_acesso** (enum `estoque_nivel_acesso`: balcao/acessivel/medio/fundo/deposito) NOT NULL, descricao, ativo |
| `estoque_fornecedores` | id, nome NOT NULL, cnpj, telefone, email, contato, prazo_entrega_dias, ativo, observacoes |
| `estoque_fornecedor_categorias` | id, fornecedor_id (FK), tipo_produto NOT NULL, lead_time_dias NOT NULL, prazo_pagamento_dias, observacao, ativo |
| `estoque_fornecedor_descontos_combo` | id, fornecedor_id (FK), categorias_combo (text[]) NOT NULL, percentual_desconto NOT NULL, valor_minimo_pedido, observacao, ativo |
| `estoque_lotes` | id, fornecedor_id (FK), nf_numero, data_entrada, valor_total NOT NULL, observacoes, user_id |
| `estoque_lote_itens` | id, lote_id (FK), produto_id (FK), quantidade, custo_unitario, **quantidade_restante** NOT NULL (PEPS) |
| `estoque_movimentacoes` | id, produto_id (FK), tipo (entrada/saida/ajuste/perda), quantidade, quantidade_anterior, orcamento_id (FK), motivo, nota_fiscal, custo_unitario, user_id, responsavel NOT NULL |
| `estoque_vendas` | id, data, cliente, total NOT NULL, vendedor_id, observacao, vendedor |
| `estoque_venda_itens` | id, venda_id (FK), produto_id (FK), quantidade, preco_unitario, desconto NOT NULL, subtotal |
| `estoque_config` | chave PK, valor NOT NULL, descricao, updated_at |

### 4.2 Foreign keys
- `estoque_movimentacoes.orcamento_id` → `orcamentos.id`
- `estoque_movimentacoes.produto_id` → `estoque_produtos.id`
- `estoque_produtos.categoria_id` → `estoque_categorias.id`
- `estoque_produtos.localizacao_id` → `estoque_localizacoes.id`
- `estoque_lote_itens.lote_id` → `estoque_lotes.id`
- `estoque_lote_itens.produto_id` → `estoque_produtos.id`
- `estoque_lotes.fornecedor_id` → `estoque_fornecedores.id`
- `estoque_venda_itens.venda_id` → `estoque_vendas.id`
- `estoque_venda_itens.produto_id` → `estoque_produtos.id`
- `estoque_fornecedor_categorias.fornecedor_id` → `estoque_fornecedores.id`
- `estoque_fornecedor_descontos_combo.fornecedor_id` → `estoque_fornecedores.id`
- `orcamento_historico.orcamento_id` → `orcamentos.id`
- `orcamentos_sombrear_ia.cliente_id` → `crm_sombrear_ia.id`

> Nota: `estoque_produtos.fornecedor` é **TEXT** que faz join por nome em algumas views (`estoque_vw_performance_fornecedor`, `estoque_calcular_ponto_pedido`) — não é FK.

### 4.3 Views

- `estoque_produtos_alerta` — produtos ativos com `quantidade_atual <= quantidade_minima`
- `estoque_vw_cobertura_margem` — consumo 90d, cobertura em dias e margem percentual por produto
- `estoque_vw_lead_time` — produto + lote mais antigo (data_entrada) + dias_em_estoque + valor_parado
- `estoque_vw_performance_categoria` — por `tipo` da categoria, vendas 90d
- `estoque_vw_performance_fornecedor` — vendas 90d por fornecedor (join por nome)
- `estoque_vw_performance_localizacao` — vendas 90d por localização
- `estoque_vw_ponto_pedido` — chama `estoque_calcular_ponto_pedido(p.id)` por produto, retorna nivel_alerta (ruptura/critico/atencao/ok/sem_dados)
- `estoque_vw_sazonalidade` — agregação mensal das vendas (último ano)
- `estoque_vw_sugestao_compra` — produtos classe A com LEC sugerido + déficit + urgencia
- `estoque_vw_sugestao_movimentacao` — sugere mover por classe ABC vs `nivel_acesso` da localização atual
- `estoque_vw_fornecedor_lead_time_efetivo` — lead time efetivo (override por categoria > geral do fornecedor > default 7)

### 4.4 Funções (PL/pgSQL)

| função | retorno | resumo |
|---|---|---|
| `estoque_calcular_giro(data_inicio, data_fim)` | record | vendas R$/qtd, estoque atual R$/qtd, giro R$/qtd |
| `estoque_calcular_lec(produto_id)` | numeric | sqrt(2·D·S/(C·i)) — D=demanda 365d, S=`custo_pedido_reais`, C=custo_unitario, i=`taxa_custo_estocagem_percent`/100. Retorna 0 se faltar dado |
| `estoque_calcular_ponto_pedido(produto_id)` | record | demanda_diaria (90d/90), lead_time_dias (do fornecedor por nome, default 7), estoque_seguranca = D·LT, ponto_pedido = D·LT + ES, cobertura_dias, nivel_alerta |
| `estoque_consumir_peps(produto_id, qtd)` | jsonb | consome lotes ordenados por data_entrada, atualiza `quantidade_restante`. Levanta exception se insuficiente |
| `estoque_recalcular_abc()` | record | reseta tudo p/ `sem_dados`, classifica via valor acumulado em vendas 90d (≤80% A, ≤95% B, resto C) |
| `fn_recalcular_abc()` | void | versão antiga por movimentações (90d), corte 20%/30% por contagem distinta |
| `estoque_fn_capital_travado(dias_minimos=90)` | record | total_produtos, total_capital_reais, por_classe (jsonb) — produtos sem saídas há N dias |
| `estoque_fn_roi_estoque()` | record | lucro_bruto_90d, anualizado, valor_estoque_atual, roi_percentual |
| `estoque_chat_contexto()` | jsonb | snapshot consolidado (resumo, giro, top 20 produtos, sugestões, parados, fornecedores, localizações, configs) — usado pelo system prompt do chat IA |
| `estoque_calcular_desconto_combo(forn_id, cats[], valor)` | record | melhor combo aplicável |
| `top_produtos_movimentados(limit=10)` | record | top saídas + entradas em 90d |
| `handle_new_user()` | trigger | INSERT em profiles ao criar auth.users; auto-aprova `luccapavanallo@gmail.com` |
| `set_updated_at()` | trigger | seta `updated_at = utc(now())` |
| `_lote_atualiza_total` / `_lote_item_atualiza_custo_medio` / `_lote_item_to_movimentacao` / `_update_estoque_from_movimentacao` / `_venda_item_peps` / `_venda_recalcula_total` | trigger | mecânica do estoque |

### 4.5 Triggers

| trigger | tabela | quando | ação |
|---|---|---|---|
| `notify_n8n_new_user` | profiles | AFTER INSERT | http_request POST → `https://n8n-n8n.yjlhot.easypanel.host/webhook/sombrear-novo-cadastro` (timeout 5000) |
| `orcamentos_set_updated_at` | orcamentos | BEFORE UPDATE | `set_updated_at()` |
| `trg_lote_atualiza_total` | estoque_lote_itens | AFTER INS/UPD/DEL | recalcula `valor_total` do lote |
| `trg_lote_item_custo_medio` | estoque_lote_itens | AFTER INSERT | atualiza `estoque_produtos.custo_unitario` (média ponderada) |
| `trg_lote_item_movimentacao` | estoque_lote_itens | AFTER INSERT | gera mov `entrada` |
| `trg_mov_estoque` | estoque_movimentacoes | AFTER INSERT | aplica delta em `estoque_produtos.quantidade_atual` (entrada/+, saida-perda/-, ajuste/=) |
| `trg_venda_item_movimentacao_peps` | estoque_venda_itens | AFTER INSERT | chama `estoque_consumir_peps` + gera mov `saida` |
| `trg_venda_recalcula_total` | estoque_venda_itens | AFTER INS/UPD/DEL | recalcula `estoque_vendas.total` |

> A trigger `handle_new_user` está em `auth.users` (schema auth, não public). O cadastro funciona assim: signup → handle_new_user → INSERT profiles → notify_n8n_new_user → webhook n8n → Gmail.

### 4.6 RLS Policies (resumo)

Padrão geral em todas as tabelas:
- **DELETE / ALL admin** → `auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com'`
- **SELECT/INSERT/UPDATE aprovados** → `EXISTS (profiles WHERE id = auth.uid() AND approved = true)`
- Algumas tabelas têm a forma simplificada `auth.role() = 'authenticated'` (`crm_sombrear_ia`, `custos_internos`, `estoque_config`, `estoque_fornecedor_categorias`, `estoque_fornecedor_descontos_combo`, `estoque_localizacoes`, `estoque_venda_itens`, `estoque_vendas`, `n8n_chat_histories`, `orcamentos_sombrear_ia`)
- `orcamento_historico` é totalmente aberto (`true/true`) para usuários autenticados
- `profiles`: usuário vê o próprio (`auth.uid() = id`), admin gerencia tudo

> **Lição aprendida** já registrada na memória: nunca referenciar `profiles` em policy DA própria tabela `profiles` (recursão infinita 500). Usar `auth.jwt() ->> 'email'`.

### 4.7 Configs atuais (`estoque_config`)
- `custo_pedido_reais` = 50.00
- `taxa_custo_estocagem_percent` = 20
- `meses_historico_demanda` = 12
- `lead_time_verde_max_dias` = 90
- `lead_time_amarelo_max_dias` = 180

### 4.8 Categorias atuais (13)
- `tecido`: Tecidos Rolo/Romana, Tecidos Vertical, Tecidos Double, Tecidos PH 50mm, Tecidos PH Alumínio
- `acessorio`: Acabamentos, Comandos e Correntes, Motores
- `ferragem`: Suportes e Fixação, Trilhos e Perfis
- `outro`: Consumíveis, Embalagens, Outros

### 4.9 Localizações ativas (6)
- `BCO-01` Atendimento/Balcão (balcao)
- `VIT-A1`, `VIT-A2` Vitrine (acessivel)
- `CEN-B1` Centro da loja (medio)
- `FUN-C1` Fundo da loja (fundo)
- `DEP-01` Depósito (deposito)

### 4.10 Fornecedores ativos (3)
- Distribuidora de Ferragens (lt 7d)
- Fornecedor Exemplo (lt 7d)
- Fornecedor Tecidos SP (lt 15d)

### 4.11 Volumetria
- Produtos ativos: **165** · inativos: 0
- Movimentações: 0 · Vendas: 0 · Lotes: 0 (estoque ainda sem operação real)
- Orçamentos: **119** · Leads CRM IA: 1 · Orçamentos IA: 3

### 4.12 Migrations
```
0001_estoque_fase1_schema.sql
0002_estoque_fase1_triggers.sql
0003_estoque_fase1_funcao_abc.sql
0004_estoque_fase2_localizacoes.sql
0004_estoque_fase4_giro_lec.sql        # ⚠ duplicidade no prefixo "0004"
0005_estoque_fase3_config_peps.sql
0006_estoque_fase3_trigger_e_view.sql
0007_estoque_fase5_ponto_pedido.sql
0008_estoque_analises_descritivas.sql
0009_estoque_ia_chat_contexto.sql
0010_fornecedores_categorias.sql
0011_estoque_calculos_prioritarios.sql
```

---

## 5. EDGE FUNCTIONS

Em `supabase/functions/`:

| nome | função |
|---|---|
| `create-user` | admin (verifica email do JWT) cria user via `admin.createUser` + auto-aprova no profiles |
| `gemini-chat` | proxy genérico p/ Gemini 1.5-flash (AI Copilot dos orçamentos, `useGemini.ts`) |
| `gemini-estoque` | proxy p/ Gemini 2.5-flash-preview-05-20 com suporte a `tools` e `systemInstruction` (function-calling do chat de estoque) |
| `n8n-cotacao` | proxy autenticado p/ webhook de cotação (mantém URL+secret fora do bundle); injeta `x-webhook-secret` se `N8N_WEBHOOK_SECRET` estiver setado |

---

## 6. CHAT IA DO ESTOQUE — design completo

**Modelo**: `gemini-2.5-flash-preview-05-20` via Edge Function `gemini-estoque`.

**System prompt** (`src/components/estoque/chat/systemPrompt.ts`): persona "IA do Estoque" — PT-BR informal, direto, executa ações via tools (não pede confirmação no texto, o sistema cuida). Injeta snapshot do `estoque_chat_contexto()`: resumo, giro anual, top 20 por valor, sugestões de compra, parados >90d, fornecedores e localizações com IDs reais.

**14 tools com 3 níveis de confirmação** (`tools.ts`):

```
NÍVEL 1 (executa direto):
  consultar_estoque_resumo       → rpc estoque_chat_contexto
  listar_produtos_classe_a       → estoque_produtos WHERE classe_abc='A'
  listar_produtos_parados        → view estoque_vw_lead_time
  listar_sugestoes_compra        → view estoque_vw_sugestao_compra
  recalcular_curva_abc           → rpc estoque_recalcular_abc
  gerar_pedido_compra_csv        → view + CSV inline

NÍVEL 2 (confirma):
  cadastrar_produto              → INSERT estoque_produtos
  cadastrar_fornecedor           → INSERT estoque_fornecedores
  cadastrar_localizacao          → INSERT estoque_localizacoes
  editar_configuracao            → UPSERT estoque_config

NÍVEL 3 (revisão completa):
  registrar_entrada              → INSERT estoque_lotes (dispara triggers)
  registrar_venda                → INSERT estoque_vendas + estoque_venda_itens (PEPS automático)
  mover_item_localizacao         → UPDATE produtos.localizacao_id
  inativar_produto               → UPDATE produtos.ativo=false
```

**Loop do `useChat.ts`**:
1. Carrega snapshot via `rpc('estoque_chat_contexto')`
2. POSTa para Edge Function com `contents` (histórico) + `tools` + `systemInstruction`
3. Se Gemini devolve `functionCall`:
   - Nível 1 → executa, segundo turn com `functionResponse`
   - Nível 2/3 → grava `pendingConfirmation`, mostra `ConfirmacaoAcao`
4. `confirmAction()` executa e faz segundo turn pra Gemini gerar reply final

> ⚠ Inconsistência detectada: `executors.ts` usa colunas `sku`/`tipo`/`custo_medio`/`classe_abc`/`lead_time_medio_dias` em alguns inserts/selects, mas o schema real usa `codigo`/(via categoria_id)/`custo_unitario`/`classificacao_abc`/`prazo_entrega_dias`. As tools L2/L3 vão quebrar quando chamadas. Provavelmente foi escrito para um schema antigo. Veja `cadastrar_produto` (sku/tipo/custo_medio), `cadastrar_fornecedor` (lead_time_medio_dias), `listar_produtos_classe_a` (sku, custo_medio, classe_abc).

---

## 7. PIPELINE n8n

- Host: `https://n8n-n8n.yjlhot.easypanel.host` (Hostinger/EasyPanel)
- **Cadastro novo usuário**: Supabase trigger → `notify_n8n_new_user` → POST `/webhook/sombrear-novo-cadastro` → workflow Gmail
- **Cotação**: frontend → Edge Function `n8n-cotacao` → webhook protegido (não exposto no bundle desde commit `53e6209`)
- **Subworkflows persianas (7 modelos)**: workflow Supervisor `XTzhHWUmv0ewvhh4` (`POST /webhook/Sombrear_sheet`)
  - `ox3dY1ErAF7AflDS` Rolo · `QdS7PySPhz7WBqOd` Double · `TH6C2XH4DZpVNttx` Romana
  - `RCb4YeZImv0SBTsK` PH Alumínio · `hQnfyByL6TxRr0lN` PV
  - `6fhbRgLi0ocbiJFb` PH 50 · `EmxIkMe9qybzU20D` Rolo Motorizado
  - Estrutura: Agent1 (custos) → Code_Validar_Output v4 → IF_Validar_1 → Switch → Code_Calculadora → Agent2 (Stella/WhatsApp) → Extrair_Mensagem
  - Bug fix 2026-04-11: `whatsBool` lia `jsonData.whats` errado → consertado p/ `$('Edit Fields').first().json.Whats`
  - Bug fix 2026-04-13: Calculator tool proibida (causava o output ser "Calling Calculator with input: ...") — agente calcula inline; instalação usa `preco_instalacao_total` direto
  - Refactor 2026-04-11: agentes de retry removidos (caiu de ~3min p/ 15-50s)

**Pipeline n8n → Supabase orçamentos**: Agente IA → Code (calcula JSON) → Code (parseBR + map de campos) → Supabase node insert. Mapeia `responsavel`, `cliente`, `tecido`, `modelo`, `custo_tecido`, `custo_m2`, `custo_acabamento`, `valor_venda`, `quantidade=1`, `status=FEITO`. `largura/altura/cor_ferragem_motor` são nullable; `modelo` sem CHECK constraint.

**Pendência aberta**: instalação sob consulta (ML > 12m) — `preco_instalacao_total=null` não tratado nos subworkflows nem na Stella.

---

## 8. ABAS DO DASHBOARD

1. **Orçamentos** — KPIs, charts (ModelosChart, ResponsavelChart), OrcamentosTable, NovoOrcamentoForm/EditOrcamentoForm, OrcamentosFechadosCard, FiltersBar com persistência local, RankingResponsavel, sort por coluna, paginação, export CSV/XLSX
2. **Cotação** — formulário que dispara webhook via `n8n-cotacao`; toast com erro detalhado em caso de falha
3. **Planilha** / **Cálculo de Custo** — visualização tabular e KPIs por modelo
4. **Agente IA** — lê `crm_sombrear_ia` + `orcamentos_sombrear_ia`; KPIs, tabela expandível, banner fora do horário; hooks `useAgenteIA.ts` (`useCrmLeads`, `useOrcamentosIA`)
5. **Análises** — gráficos derivados
6. **Estoque** — múltiplas subtabs internas (entradas, produtos, movimentações, lotes, vendas, fornecedores, localizações, mover itens, ponto de pedido, sugestões, análises descritivas, configuração) + Chat IA drawer + ChatTrigger fixo
7. **Kanban** — board (compartilhamento ativo via `migration_kanban_share.sql`)
8. **Admin** (apenas admin) — `PainelAdmin` (aprovar/revogar) + `PermissoesView` (granular: pode_orcamento, pode_estoque)

---

## 9. ESTADO DE DEPLOY

- Branch atual: `main` · commit `cad227c`
- Build: ✅ passa (`npm run build`)
- 21 branches `feat/estoque-*` ainda existem no remoto (fases 1-5, IA fundação/backend, etc.)

### Últimos 20 commits
```
cad227c fix(build): corrigir useRef(adminSub) usado antes da declaração
2e093cb feat(ux): sort por coluna + col visibility + spinners nos forms
bd993e7 feat(ux): slide no Admin, contador X/Y, filtros persistentes, paginação e export CSV/XLSX
6ee7c71 fix(cotacao): erros detalhados no toast (Edge Function + catch)
f026329 fix(cotacao): botão sempre clicável — validate() mostra o erro exato
73095ac feat: UX das tabelas + top loading bar
552fc40 feat: skeletons específicos por aba, animação subtabs Estoque, max-h tabelas
9666123 style: últimas consistências de design entre as 3 seções
40a61b3 fix(routing): /orcamento/:id → /orcamentos/* para evitar conflito com rota pública
a55cde9 fix(build): substituir TAB_LABELS por SECTION_LABELS na exibição de presença
c8aac84 feat: orçamentos com subtab bar própria + fixes de design
e4b5683 feat: URLs por seção (/orcamento/*) e título Sombrear - {Seção}
9ca9e97 style: padronizar design KPI cards e espaçamento entre Orçamentos/Estoque/Admin
53e6209 fix(security): remover API keys do bundle — proxy via Edge Functions
10fe927 chore: auditoria de seguranca ponta a ponta
8718d0b feat: otimizacao mobile completa (375-430px) das 8 telas principais
d53040a feat(permissoes): sistema de permissões granulares + área admin expandida
1ec4b41 fix(estoque): remover badge de notificacao das sub-tabs
4bccc1d feat(estoque): subtabs largura igual + aba perguntar a ia 1.5x
a7e25da fix(home): destacar logo e centralizar/aumentar cards
```

---

## 10. TYPES PRINCIPAIS (`src/lib/supabase.ts`)

Já tipados: `Orcamento`, `CustoInterno`, `EstoqueCategoria`, `EstoqueProduto` (+ embed de categorias e localizacao), `EstoqueLocalizacao`, `EstoqueSugestaoMover`, `EstoqueFornecedor`, `FornecedorCategoria`, `FornecedorDescontoCombo`, `EstoqueLote`, `EstoqueLoteItem`, `EstoqueProdutoAlerta`, `EstoqueMovimentacao`, `EstoqueVenda`, `EstoqueVendaItem`, `SugestaoCompra`, `CoberturaMargemRow`, `ROIEstoqueResult`, `CapitalTravadoResult`.

`Profile` em `src/hooks/useProfile.ts`: `id, email, full_name, approved (bool|null), is_admin, pode_orcamento, pode_estoque, created_at`.

---

## 11. PONTOS DE ATENÇÃO / DÍVIDA TÉCNICA

1. **`executors.ts` desincronizado do schema** — usa `sku`/`tipo`/`custo_medio`/`classe_abc`/`lead_time_medio_dias`. Tools L2/L3 do chat IA quebram em runtime. Precisa alinhar com `codigo`/`categoria_id`/`custo_unitario`/`classificacao_abc`/`prazo_entrega_dias`.
2. **Memória diz `custo_total` foi removido** mas a coluna ainda existe em `orcamentos`. Atualizar memória ou consolidar.
3. **`fn_recalcular_abc` (void) e `estoque_recalcular_abc` (record)** coexistem — versões antigas/novas. A nova é a usada pelo chat IA.
4. **`estoque_produtos.fornecedor` é TEXT, não FK** — joins via nome em views e em `estoque_calcular_ponto_pedido`. Migrar para `fornecedor_id` UUID seria mais robusto.
5. **Dois prefixos `0004_`** em migrations.
6. **Vários scripts soltos no root** (`fix_*.cjs/js`, `validar_code_v3.js`, `wf_ox3dY1ErAF7AflDS.json`) e `FASE3_RESUMO.md`, `docs/`, `supabase/.temp/` não commitados — limpeza pendente.
7. **Vendor chunks**: TabEstoque ainda 528 KB (aviso do Vite); considerar split por subtab.
8. **Pendência n8n**: instalação sob consulta (ML > 12m) sem tratamento.

---

## 12. COMO RODAR EM OUTRO CONTEXTO

```bash
# 1. clonar e instalar
git clone https://github.com/luccapa-pav/Dash-Sombrear
cd Dash-Sombrear
npm install

# 2. .env (copiar do .env.example e preencher)
VITE_SUPABASE_URL=https://nlswyjpjzibuvdsaooyg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_fzqnvcRh3yww4V_2nATdTg_4V_o_Mi3
VITE_FEATURE_AI_ESTOQUE=true   # se quiser o chat
VITE_GOOGLE_SHEETS_ID=...
VITE_GOOGLE_SHEETS_GID=...

# 3. dev
npm run dev    # http://localhost:5173
npm run build  # produção

# 4. Edge Functions (se for tocar)
# Token de acesso: setar SUPABASE_ACCESS_TOKEN
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase login
npx supabase link --project-ref nlswyjpjzibuvdsaooyg
npx supabase functions deploy gemini-estoque

# 5. Acesso admin: luccapavanallo@gmail.com (auto-aprovado pelo handle_new_user)
```

### Curl no Windows-MSYS para Management API
Sempre passar `--ssl-no-revoke`:
```
curl --ssl-no-revoke -X POST \
  "https://api.supabase.com/v1/projects/nlswyjpjzibuvdsaooyg/database/query" \
  -H "Authorization: Bearer sbp_..." \
  -H "Content-Type: application/json" \
  --data-binary @query.json
```
