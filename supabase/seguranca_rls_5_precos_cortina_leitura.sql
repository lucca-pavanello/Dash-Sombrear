-- Leva 6 de RLS — leitura dos preços de cortina para usuário aprovado
-- (2026-08-14). As tabelas precos_cortina_* nasceram só com a política
-- eh_admin_precos() para TUDO: vendedor comum não lia os preços e a
-- calculadora de cortina carregava vazia. Escrever segue coisa de admin.
-- JÁ APLICADO em produção via Management API — este arquivo é registro.

create policy precos_cortina_tecidos_ver on public.precos_cortina_tecidos
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true));

create policy precos_cortina_valores_ver on public.precos_cortina_valores
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true));
