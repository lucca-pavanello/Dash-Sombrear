-- ═══════════════════════════════════════════════════════════════════════════
--  Sombrear — ajustes de segurança (RLS)                         13/08/2026
--  Cole no SQL Editor do Supabase e rode de uma vez. Pode rodar de novo sem
--  problema (é idempotente). Nenhuma linha de dado é apagada.
--
--  O que muda, em português:
--   1. quem é admin deixa de ser um e-mail escrito no código
--   2. cadastro ainda NÃO aprovado para de enxergar leads e histórico
--   3. o histórico de alterações deixa de poder ser editado ou apagado
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Duas funções auxiliares ────────────────────────────────────────────
-- Precisam ser SECURITY DEFINER: consultar `profiles` de dentro de uma policy
-- da própria `profiles` causa recursão infinita e derruba o dash com erro 500
-- (já aconteceu aqui). A função roda por fora da RLS e resolve isso.

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

create or replace function public.eh_aprovado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = true
  );
$$;

-- ── 2) Ninguém pode perder o acesso na troca ──────────────────────────────
-- Hoje o Lucca é admin só porque o e-mail dele está escrito na policy —
-- a coluna is_admin dele está FALSE. Sem esta linha, ele perderia o painel
-- de usuários no passo 3.
update public.profiles set is_admin = true
where email = 'luccapavanallo@gmail.com' and is_admin is distinct from true;

-- ── 3) profiles: sai o e-mail fixo, entra o is_admin ──────────────────────
drop policy if exists "Admin gerencia todos"     on public.profiles;
drop policy if exists "Admin atualiza aprovação" on public.profiles;
drop policy if exists "admin_gerencia_perfis"    on public.profiles;

create policy "admin_gerencia_perfis" on public.profiles
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());
-- (a policy "Usuário vê próprio perfil" continua como está)

-- ── 4) Histórico de alterações: só aprovado lê, e vira à prova de rasura ──
-- Hoje QUALQUER pessoa logada — inclusive cadastro não aprovado — pode ler,
-- editar e APAGAR o histórico. Como ele é a prova de quem mexeu em quanto,
-- passa a ser só leitura + gravação: sem UPDATE e sem DELETE para ninguém.
drop policy if exists "auth users historico" on public.orcamento_historico;
drop policy if exists "historico_ver"        on public.orcamento_historico;
drop policy if exists "historico_gravar"     on public.orcamento_historico;

create policy "historico_ver" on public.orcamento_historico
  for select to authenticated using (public.eh_aprovado());

create policy "historico_gravar" on public.orcamento_historico
  for insert to authenticated with check (public.eh_aprovado());

-- ── 5) CRM e orçamentos da IA: exigir aprovação, não só estar logado ──────
-- Hoje basta ter conta criada (mesmo pendente de aprovação) para ler todos os
-- leads, telefones e conversas. O dash marca "converteu" e a origem do lead,
-- então o UPDATE do CRM continua liberado para aprovados. Quem escreve de
-- verdade é o n8n, pela service_role, que não passa por RLS.
drop policy if exists auth_only        on public.crm_sombrear_ia;
drop policy if exists crm_ver          on public.crm_sombrear_ia;
drop policy if exists crm_atualizar    on public.crm_sombrear_ia;

create policy crm_ver on public.crm_sombrear_ia
  for select to authenticated using (public.eh_aprovado());

create policy crm_atualizar on public.crm_sombrear_ia
  for update to authenticated
  using (public.eh_aprovado())
  with check (public.eh_aprovado());

drop policy if exists auth_only            on public.orcamentos_sombrear_ia;
drop policy if exists orcamentos_ia_ver    on public.orcamentos_sombrear_ia;

create policy orcamentos_ia_ver on public.orcamentos_sombrear_ia
  for select to authenticated using (public.eh_aprovado());

-- ── 6) Conferência ────────────────────────────────────────────────────────
-- Deve listar: admin_gerencia_perfis, historico_ver, historico_gravar,
-- crm_ver, crm_atualizar, orcamentos_ia_ver — e nenhuma com "true" solto.
select tablename, policyname, cmd, coalesce(qual, with_check) as regra
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'orcamento_historico', 'crm_sombrear_ia', 'orcamentos_sombrear_ia')
order by tablename, policyname;
