-- Leva 4 de RLS — a estante de relatórios da IA (2026-08-14).
-- relatorios_ia e relatorios_pedidos nasceram sem RLS (Terminal 1 as criou
-- pro workflow JpZHo2U2y3eY4cjj); o dash lê/insere com a anon key, então sem
-- cerca qualquer portador da chave lia os números do negócio.
-- Leitura e pedido: usuário aprovado. Escrita dos relatórios e virada de
-- status: só o n8n, via service role (que atravessa o RLS).
-- JÁ APLICADO em produção via Management API — este arquivo é registro.

alter table public.relatorios_ia enable row level security;
alter table public.relatorios_pedidos enable row level security;

create policy relatorios_ia_ver on public.relatorios_ia
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true));

create policy relatorios_pedidos_ver on public.relatorios_pedidos
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true));

create policy relatorios_pedidos_pedir on public.relatorios_pedidos
  for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.approved = true));
