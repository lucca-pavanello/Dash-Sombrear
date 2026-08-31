-- Backfill de pedido_id pra itens já lançados que são, na prática, o mesmo
-- pedido (mesmo texto de `cliente`, itens lançados na mesma janela de tempo).
-- A convenção real da loja hoje é embutir o número do pedido no próprio
-- campo `cliente` ("Paulo Silvio / pedido 128"), não em `numero_pedido`
-- (quase sempre null) — por isso o agrupamento é por `cliente` exato.
--
-- Só agrupa quando todos os itens do cliente caem numa janela de até 2 dias
-- (evita juntar por engano um texto de cliente reaproveitado meses depois).
-- Casos fora dessa janela ficam com pedido_id = NULL, exatamente como hoje —
-- sem regressão, só sem o benefício do agrupamento até alguém vincular pela
-- ferramenta manual no Semanário.
--
-- Loop em PL/pgSQL (não um JOIN de CTEs) de propósito: a maioria dos itens
-- tem numero_pedido/data_pedido NULOS, e NULL não é chave de correlação
-- confiável num JOIN ("IS NOT DISTINCT FROM NULL" bateria com todo mundo
-- que também é nulo, juntando pedidos errados entre si). Um pedido por vez,
-- com o id capturado direto do INSERT, elimina esse risco.
do $$
declare
  grupo record;
  primeiro record;
  novo_pedido_id uuid;
begin
  for grupo in
    select cliente
    from public.orcamentos
    where cliente is not null and fechado = true
    group by cliente
    having count(*) > 1
       and max(coalesce(data_pedido::timestamptz, created_at))
         - min(coalesce(data_pedido::timestamptz, created_at)) < interval '2 days'
  loop
    select * into primeiro
    from public.orcamentos
    where cliente = grupo.cliente and fechado = true
    order by created_at asc
    limit 1;

    insert into public.pedidos (numero_pedido, data_pedido, origem, forma_pagamento, forma_pagamento_real)
    values (primeiro.numero_pedido, primeiro.data_pedido, primeiro.origem,
            primeiro.forma_pagamento, primeiro.forma_pagamento_real)
    returning id into novo_pedido_id;

    update public.orcamentos
    set pedido_id = novo_pedido_id
    where cliente = grupo.cliente and fechado = true and pedido_id is null;
  end loop;
end $$;
