-- ═══════════════════════════════════════════════════════════════════════════
--  Sombrear — segurança (RLS), segunda leva                      13/08/2026
--  Cole no SQL Editor do Supabase e rode de uma vez. Idempotente.
--
--  Depende do primeiro script (supabase/seguranca_rls.sql), que criou a
--  função public.eh_aprovado(). Se ela não existir, rode aquele antes.
--
--  O que muda: sai "basta estar logado", entra "precisa estar aprovado".
--  As regras continuam FOR ALL (ler, gravar, editar, apagar) exatamente como
--  hoje, porque o dash escreve em todas essas tabelas — a única diferença é
--  que cadastro pendente de aprovação para de alcançar qualquer uma delas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Trava de segurança: não deixa rodar sem a função do primeiro script.
do $$
begin
  if to_regprocedure('public.eh_aprovado()') is null then
    raise exception 'Rode antes o supabase/seguranca_rls.sql (falta a função eh_aprovado)';
  end if;
end $$;

-- ── 1) Custos internos (27 registros hoje) ────────────────────────────────
-- É a margem da loja item a item. Hoje qualquer conta logada lê E escreve.
drop policy if exists auth_only            on public.custos_internos;
drop policy if exists custos_internos_rw   on public.custos_internos;
create policy custos_internos_rw on public.custos_internos
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

-- ── 2) Estoque: vendas, itens, config, locais e dados de fornecedor ───────
drop policy if exists auth_all                on public.estoque_vendas;
drop policy if exists estoque_vendas_rw       on public.estoque_vendas;
create policy estoque_vendas_rw on public.estoque_vendas
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

drop policy if exists auth_all                on public.estoque_venda_itens;
drop policy if exists estoque_venda_itens_rw  on public.estoque_venda_itens;
create policy estoque_venda_itens_rw on public.estoque_venda_itens
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

drop policy if exists auth_all                on public.estoque_config;
drop policy if exists estoque_config_rw       on public.estoque_config;
create policy estoque_config_rw on public.estoque_config
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

drop policy if exists auth_all                on public.estoque_localizacoes;
drop policy if exists estoque_localizacoes_rw on public.estoque_localizacoes;
create policy estoque_localizacoes_rw on public.estoque_localizacoes
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

drop policy if exists auth_only                     on public.estoque_fornecedor_categorias;
drop policy if exists estoque_forn_categorias_rw    on public.estoque_fornecedor_categorias;
create policy estoque_forn_categorias_rw on public.estoque_fornecedor_categorias
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

drop policy if exists auth_only                     on public.estoque_fornecedor_descontos_combo;
drop policy if exists estoque_forn_descontos_rw     on public.estoque_fornecedor_descontos_combo;
create policy estoque_forn_descontos_rw on public.estoque_fornecedor_descontos_combo
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

-- ── 3) Memória das conversas da Stella ────────────────────────────────────
-- O dash não usa esta tabela; quem escreve é o n8n pela service_role, que não
-- passa por RLS. Então aqui é só fechar a leitura para quem não é aprovado.
drop policy if exists auth_only              on public.n8n_chat_histories;
drop policy if exists n8n_chat_histories_rw  on public.n8n_chat_histories;
create policy n8n_chat_histories_rw on public.n8n_chat_histories
  for all to authenticated
  using (public.eh_aprovado()) with check (public.eh_aprovado());

-- ── 4) Chaves das automações ──────────────────────────────────────────────
-- A escrita já é só de admin (eh_admin_precos). A leitura estava aberta para
-- qualquer conta logada — e ali dentro fica, por exemplo, o número do grupo
-- de WhatsApp que recebe o aviso de fechamento.
drop policy if exists config_automacoes_leitura on public.config_automacoes;
create policy config_automacoes_leitura on public.config_automacoes
  for select to authenticated using (public.eh_aprovado());

-- ── 5) Conferência ────────────────────────────────────────────────────────
-- Não deve sobrar nenhuma linha com "auth.role()" ou "true" solto.
select tablename, policyname, cmd, coalesce(qual, with_check) as regra
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or qual ilike '%auth.role()%' or with_check = 'true')
order by tablename, policyname;
