-- Pedidos: metadados canônicos de um pedido real da loja, que pode conter 1+
-- itens em orcamentos. NÃO guarda dinheiro — cada item continua com seu
-- próprio valor_cobrado/valor_parceiro_pago/custos_detalhe, exatamente como
-- hoje; o pedido só evita redigitar numero_pedido/data_pedido/origem/forma
-- de pagamento em cada item separadamente (causa raiz do bug: 3 itens do
-- mesmo pedido digitados 3 vezes podem divergir).
create table if not exists public.pedidos (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default timezone('utc', now()),
  numero_pedido         text,
  data_pedido           date,
  origem                text,
  forma_pagamento       text,
  forma_pagamento_real  text,
  observacoes           text,
  user_id               uuid references auth.users(id) on delete set null
);

create index if not exists idx_pedidos_numero_pedido on public.pedidos (numero_pedido);
create index if not exists idx_pedidos_data_pedido   on public.pedidos (data_pedido);

alter table public.orcamentos
  add column if not exists pedido_id uuid references public.pedidos(id) on delete set null;

create index if not exists idx_orcamentos_pedido_id on public.orcamentos (pedido_id);

alter table public.pedidos enable row level security;

drop policy if exists pedidos_ver     on public.pedidos;
drop policy if exists pedidos_inserir on public.pedidos;
drop policy if exists pedidos_editar  on public.pedidos;
drop policy if exists pedidos_excluir on public.pedidos;

create policy pedidos_ver     on public.pedidos for select to authenticated using (public.eh_aprovado());
create policy pedidos_inserir on public.pedidos for insert to authenticated with check (public.eh_aprovado());
create policy pedidos_editar  on public.pedidos for update to authenticated using (public.eh_aprovado());
create policy pedidos_excluir on public.pedidos for delete to authenticated using (public.eh_admin());
