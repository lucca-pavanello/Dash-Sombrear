-- Leva 3 de RLS — exclusão de venda vira coisa de admin (decisão do Arthur,
-- 14/08/2026). Antes, quem tinha pode_fechamento também podia apagar; agora
-- apagar faturamento (e gravar na lixeira) exige is_admin ou o e-mail fixo.
-- JÁ APLICADO em produção via Management API em 2026-08-14 — este arquivo é
-- o registro, não uma pendência.

drop policy if exists orcamentos_excluir on public.orcamentos;
create policy orcamentos_excluir on public.orcamentos
  for delete to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.approved = true
      and (p.is_admin = true or p.email = 'luccapavanallo@gmail.com')
  ));

drop policy if exists orcamentos_excluidos_gravar on public.orcamentos_excluidos;
create policy orcamentos_excluidos_gravar on public.orcamentos_excluidos
  for insert to authenticated
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.approved = true
      and (p.is_admin = true or p.email = 'luccapavanallo@gmail.com')
  ));
