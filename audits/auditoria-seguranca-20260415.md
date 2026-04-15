# Auditoria de Segurança — Sombrear Dashboard
**Data:** 15/04/2026
**Escopo:** Frontend + Backend (Supabase) + Integrações + Secrets + Deploy
**Auditor:** Claude Code (automatizado)
**Stack real:** React + Vite + TypeScript + Supabase + Vercel *(o spec assume Next.js — não existem API routes nem middleware.ts neste projeto)*

---

## Resumo Executivo

| Severidade | Achados |
|---|---|
| ❌ CRÍTICO | 6 |
| ⚠️ ALTO | 6 |
| 🔵 MÉDIO | 4 |
| ℹ️ BAIXO | 3 |
| ✅ SEM ACHADO | 8 itens positivos confirmados |

**Veredicto:** O sistema **NÃO deve ser apresentado a clientes** sem corrigir ao menos os 6 críticos. Os itens #3–#5 (tabelas CRM/orçamentos/chat sem RLS) representam vazamento de dados de clientes acessível por qualquer pessoa com a anon key pública — que está, por design, no bundle JavaScript.

---

## Fase 1 — Secrets e Exposição

### ❌ CRÍTICO #1 — `VITE_GEMINI_API_KEY` exposta no bundle do browser

**Variável:** `VITE_GEMINI_API_KEY=AIzaSyDNI7oUO_zZXRd4PKxB9vDn-XycsEUr5Kc`

Em Vite, **qualquer variável com prefixo `VITE_` é compilada no JavaScript final** e visível em DevTools → Sources → bundle.js. A chave do Google Gemini é carregada diretamente no navegador:

```ts
// src/components/estoque/chat/useChat.ts:9
// src/components/estoque/chat/useChatAPI.ts:10
// src/hooks/useGemini.ts:5
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
```

**Impacto:** Qualquer pessoa que inspecionar o site roba a chave e usa toda sua cota do Google AI Studio, gerando custos não autorizados ou dados de negócio expostos via prompt injection.

**Correção:** Mover chamadas Gemini para uma Edge Function do Supabase (server-side). A chave fica em variáveis de ambiente da Edge Function, nunca no browser.

---

### ❌ CRÍTICO #2 — `VITE_GOOGLE_SHEETS_API_KEY` exposta

**Variável:** `VITE_GOOGLE_SHEETS_API_KEY=AIzaSyAk0_fAiphIR3g0c-AtUTuQ8c2FOJ9d4UU`

Usada em `src/hooks/useModelosTecidos.ts` para buscar dados de planilhas Google.

**Impacto:** Chave exposta pode ser usada para abusar da API do Google Sheets da conta associada (leitura de outras planilhas, quota esgotada).

**Correção imediata:** Rotacionar a chave no Google Cloud Console e criar nova sem prefixo VITE_. Fazer a requisição no servidor.

---

### ⚠️ ALTO #8 — `VITE_N8N_WEBHOOK` URL exposta

**Variável:** `VITE_N8N_WEBHOOK=https://n8n-n8n.yjlhot.easypanel.host/webhook/Sombrear_sheet`

Usada em `src/components/tabs/TabCotacao.tsx` para disparar cotações.

**Impacto:** Qualquer pessoa pode fazer POST para este webhook com dados forjados, gerando cotações falsas, spamando clientes via WhatsApp, ou exaurindo recursos do n8n/Gemini.

**Mitigação:** Adicionar token de autenticação no header do webhook (n8n suporta Header Auth). Token guardado sem prefixo VITE_.

---

### ✅ Sem achado — Service role key

Nenhuma ocorrência de `SUPABASE_SERVICE_KEY` ou `SERVICE_ROLE` em `src/`. O `.env` tem comentário correto alertando para não usar prefixo VITE_ nessa chave.

### ✅ Sem achado — Histórico do git

Verificação do git log completo: nenhum arquivo `.env` foi commitado em nenhum momento. Nenhuma chave `AIzaSy...` hardcoded em commits. O `.gitignore` ignora `.env` e `.env.local` corretamente.

---

## Fase 2 — Supabase (Backend)

### ❌ CRÍTICO #3 — `crm_sombrear_ia` sem RLS (dados de clientes expostos)

**Tabelas sem Row Level Security habilitado:**
```
crm_sombrear_ia          ← dados de clientes: WhatsApp, CEP, resumo_conversa, status_lead
orcamentos_sombrear_ia   ← orçamentos IA: valores, medidas, cliente_id
n8n_chat_histories       ← histórico de conversas
custos_internos          ← dados financeiros internos
estoque_fornecedor_categorias    ← criada em migration 0010 sem RLS
estoque_fornecedor_descontos_combo ← idem
```

**Como explorar:** A anon key (`VITE_SUPABASE_ANON_KEY`) está no bundle público. Basta:
```bash
curl https://nlswyjpjzibuvdsaooyg.supabase.co/rest/v1/crm_sombrear_ia \
  -H "apikey: sb_publishable_fzqnvcRh3yww4V_2nATdTg_4V_o_Mi3" \
  -H "Authorization: Bearer sb_publishable_fzqnvcRh3yww4V_2nATdTg_4V_o_Mi3"
```
Retorna todos os dados de clientes sem autenticação.

**Correção imediata (SQL Editor do Supabase):**
```sql
-- Habilitar RLS nas tabelas sem proteção
ALTER TABLE crm_sombrear_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos_sombrear_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_fornecedor_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_fornecedor_descontos_combo ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas usuários autenticados acessam
CREATE POLICY "auth_only" ON crm_sombrear_ia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON orcamentos_sombrear_ia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON n8n_chat_histories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON custos_internos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON estoque_fornecedor_categorias FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON estoque_fornecedor_descontos_combo FOR ALL USING (auth.role() = 'authenticated');
```

---

### ❌ CRÍTICO #4 — `orcamentos_sombrear_ia` sem RLS

Ver #3 acima. Contém: modelo, ambiente, largura, altura, quantidade, tecido, acabamento, `custo_total_base`, `valor_venda_total_base` — dados financeiros e de negócio sensíveis.

---

### ❌ CRÍTICO #5 — `n8n_chat_histories` sem RLS

Ver #3 acima. Histórico de conversas pode conter dados pessoais de clientes, dados financeiros, ou informações estratégicas de negócio.

---

### ⚠️ ALTO #7 — `custos_internos` sem RLS

Ver #3 acima. Dados de custos internos do negócio acessíveis sem autenticação.

---

### 🔵 MÉDIO #14 — `profiles` UPDATE policy — privilege escalation potencial

A tabela `profiles` tem policy de UPDATE, mas não foi verificado se ela bloqueia self-update dos campos `approved` e `role`. Se a policy for `USING (id = auth.uid())` sem `WITH CHECK` restritivo, um usuário poderia se promover a admin via:
```js
supabase.from('profiles').update({ approved: true, role: 'admin' }).eq('id', auth.uid())
```

**Verificar no SQL Editor:**
```sql
SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE';
```

**Correção se necessário:**
```sql
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND approved = (SELECT approved FROM profiles WHERE id = auth.uid()) AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
```

---

### Funções SECURITY DEFINER (9 encontradas)

| Função | Risco |
|---|---|
| `_lote_atualiza_total` | Trigger interno — OK |
| `_lote_item_atualiza_custo_medio` | Trigger interno — OK |
| `_lote_item_to_movimentacao` | Trigger interno — OK |
| `_update_estoque_from_movimentacao` | Trigger interno — OK |
| `_venda_item_peps` | Trigger interno — OK |
| `_venda_recalcula_total` | Trigger interno — OK |
| `handle_new_user` | Auth trigger — OK |
| `estoque_consumir_peps` | **RPC público** — authenticated pode chamar diretamente, consumindo estoque sem criar venda |
| `estoque_chat_contexto` | **RPC público** — retorna snapshot do estoque para IA |

`estoque_consumir_peps` chamável via `.rpc('estoque_consumir_peps', {p_produto_id, p_quantidade})` por qualquer usuário autenticado. Não é crítico (requer auth), mas é uma superfície de ataque para manipulação de inventário.

---

### RLS + Policies — Tabelas protegidas ✅

As tabelas principais estão corretamente protegidas:
- `profiles` — ALL + SELECT + UPDATE policies
- `orcamentos` — SELECT/INSERT/UPDATE/DELETE separados
- `estoque_produtos`, `estoque_lotes`, `estoque_movimentacoes` — políticas por operação
- `estoque_config` — ALL policy com `auth.role() = 'authenticated'`
- `orcamento_historico` — ALL policy

**Sem tabelas com RLS habilitado e sem policies** (o cenário "ninguém acessa nada" que quebraria o app não existe).

---

### Storage Buckets

Nenhum bucket de storage configurado. N/A.

---

## Fase 3 — Frontend

### ✅ Sem achado — XSS via dangerouslySetInnerHTML

Grep completo em `src/`: **zero ocorrências**. A aplicação não usa `dangerouslySetInnerHTML`, `eval()` ou `new Function()`. Conteúdo Markdown é renderizado via `react-markdown` (seguro por padrão).

---

### ✅ Sem achado — Autenticação e proteção de rotas

`src/App.tsx` implementa corretamente:
1. `supabase.auth.getSession()` com timeout de 5s (evita loading infinito)
2. `onAuthStateChange` para atualizações em tempo real
3. `if (!profile?.approved)` bloqueia acesso até aprovação manual do admin
4. Redirect automático para `/login` sem sessão
5. Rota pública `/orcamento/:id` corretamente isolada

---

### Validação de formulários — parcialmente OK

| Formulário | Validação | Status |
|---|---|---|
| `EntradaRapidaForm.tsx` | Zod + react-hook-form | ✅ |
| `RegistroVendasView.tsx` | Zod + react-hook-form | ✅ |
| `ConfiguracaoView.tsx` | Zod customizado | ✅ |
| `NovoOrcamentoForm.tsx` | useState manual, validateStep() | ⚠️ Sem Zod |
| `TabCotacao.tsx` | Funções manuais persianaFilled/medidaFilled | ⚠️ Sem Zod |

Formulários sem Zod têm validação funcional mas sem type-safety. Risco é UX principalmente (client-side), não segurança grave (Supabase rejeita tipos incorretos no banco).

---

### 🔵 MÉDIO #15 — Sem headers de segurança (CSP, X-Frame-Options etc.)

O projeto não tem `vercel.json` configurando headers de segurança. A Vercel adiciona alguns headers por padrão, mas CSP, X-Frame-Options e Permissions-Policy precisam ser configurados explicitamente.

**Correção — criar `vercel.json`:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## Fase 4 — API Routes

**N/A** — Stack é React + Vite, não Next.js. Não existem `src/app/api/` routes nem `middleware.ts`. Toda lógica server-side ocorre via Supabase Edge Functions ou diretamente no Supabase DB (RLS + funções).

---

## Fase 5 — Integrações Externas

### ❌ CRÍTICO #1 (já listado) — Gemini API no client-side

Ver Fase 1, achado #1.

### ❌ CRÍTICO #2 (já listado) — Google Sheets API no client-side

Ver Fase 1, achado #2.

### ⚠️ ALTO #8 (já listado) — Webhook n8n exposto

Ver Fase 1, achado #8.

### Sem CORS aberto identificado

As chamadas são feitas via SDKs (Supabase JS, Google AI SDK) com CORS gerenciado pelos próprios serviços. Não há configuração de CORS manual aberta.

---

## Fase 6 — Dependências (npm audit)

**5 vulnerabilidades encontradas: 1 critical, 3 high, 1 moderate**

| Pacote | Severidade | CVE | Fix |
|---|---|---|---|
| `jspdf` | ❌ CRÍTICO | PDF Object Injection (GHSA-7x6v-j9x4-qf24) + HTML Injection | `npm audit fix` disponível |
| `xlsx` | ⚠️ ALTO | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS | ❌ Sem fix upstream |
| `lodash` | ⚠️ ALTO | Prototype Pollution + Code Injection via template (dep transitiva) | `npm audit fix` disponível |
| `picomatch` | ⚠️ ALTO | ReDoS via extglob (dep transitiva de ferramentas de build) | `npm audit fix` disponível |
| `dompurify` | 🔵 MODERADO | Mutation-XSS (dep transitiva) | `npm audit fix` disponível |

**Correção imediata:** `npm audit fix` resolve jspdf, lodash, picomatch e dompurify.

**`xlsx`:** Sem fix disponível. Considerar alternativa (`exceljs` ou `papaparse` para CSV). Risco moderado em prática — prototype pollution requer input controlado pelo atacante.

---

## Fase 7 — LGPD

### ℹ️ BAIXO #18 — Coleta de dados pessoais sem documentação LGPD

O sistema coleta e armazena:
- `crm_sombrear_ia`: WhatsApp, nome, CEP, endereço, resumo de conversa
- `profiles`: email, nome completo
- `orcamentos`: cliente, telefone

**Pendências LGPD (Art. 7, 9, 18):**
- Termo de uso / política de privacidade ausente
- Sem mecanismo de exclusão de dados (Art. 18 — direito ao esquecimento)
- Supabase hospedado em região US-East (dados brasileiros fora do Brasil — verificar DPA)

**Obs:** Para uso interno/piloto com poucos usuários conhecidos, o risco prático é baixo. Mas antes de escalar para clientes externos, é necessário endereçar.

---

## Fase 8 — Testes Práticos (verificação via Management API)

### ❌ CONFIRMADO — Tabelas sem RLS acessíveis sem autenticação

Confirmado via consulta direta ao banco:
- `crm_sombrear_ia`, `orcamentos_sombrear_ia`, `n8n_chat_histories`, `custos_internos` estão acessíveis via anon key sem nenhuma autenticação.

### ✅ CONFIRMADO — Tabelas com RLS protegidas

Tabelas com RLS habilitado (`estoque_produtos`, `orcamentos`, `profiles` etc.) retornam 0 linhas para anon key (RLS bloqueia corretamente, nenhum dado vaza).

---

## Plano de Correção Recomendado

### URGENTE — Antes de qualquer apresentação a clientes

**1. Habilitar RLS nas 6 tabelas abertas** (15 min, SQL Editor Supabase)
```sql
ALTER TABLE crm_sombrear_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos_sombrear_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_fornecedor_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_fornecedor_descontos_combo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON crm_sombrear_ia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON orcamentos_sombrear_ia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON n8n_chat_histories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON custos_internos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON estoque_fornecedor_categorias FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON estoque_fornecedor_descontos_combo FOR ALL USING (auth.role() = 'authenticated');
```

**2. Corrigir jspdf** (2 min)
```bash
npm audit fix
```

**3. Rotacionar chave Gemini** — mesmo exposta, rotacionar é obrigatório se o site já esteve em produção. Gerar nova chave no Google AI Studio, atualizar na Vercel e no `.env` local.

---

### CURTO PRAZO — Esta semana

**4. Mover Gemini para Edge Function** — criar `supabase/functions/gemini-chat/index.ts`, mover a inicialização de `GoogleGenerativeAI` para lá. Frontend chama a Edge Function em vez da API Google diretamente.

**5. Mover Google Sheets para Edge Function** — idem, `supabase/functions/modelos-tecidos/index.ts`.

**6. Adicionar auth ao webhook n8n** — configurar Header Auth no n8n (Settings → Credentials → Header Auth), adicionar header `x-webhook-secret` no código, guardar o token sem prefixo VITE_.

**7. Verificar policy UPDATE de profiles** — confirmar se bloqueia self-elevation de `approved` e `role`.

**8. Adicionar vercel.json com headers de segurança** (10 min).

---

### MÉDIO PRAZO — Próximas semanas

**9. Avaliar substituição do xlsx** — testar `exceljs` como alternativa (tem fix para prototype pollution).

**10. Adicionar `estoque_consumir_peps` com validação** — adicionar verificação interna na função de que o chamador tem `pode_estoque = true` no profile antes de consumir.

**11. Criar tabela de audit log** — `estoque_audit_log(tabela, operacao, registro_id, usuario_id, dados_antes jsonb, dados_depois jsonb, created_at)` com triggers em `estoque_vendas` e `estoque_movimentacoes`.

**12. Criar `.env.example`** com todos os campos e valores de placeholder.

---

## Achados Positivos Confirmados

| Item | Status |
|---|---|
| Service role key não exposta em src/ | ✅ |
| Nenhum `dangerouslySetInnerHTML` | ✅ |
| Nenhum `.env` no histórico do git | ✅ |
| Nenhuma chave hardcoded em commits | ✅ |
| `.gitignore` correto (ignora .env) | ✅ |
| Proteção de rotas com sessão + aprovação | ✅ |
| Sem storage buckets públicos | ✅ |
| Tabelas principais com RLS + policies | ✅ |
| Formulários principais com Zod | ✅ |

---

*Gerado automaticamente por Claude Code em 15/04/2026. Dados reais coletados via leitura de código-fonte, git history e Management API do Supabase.*
