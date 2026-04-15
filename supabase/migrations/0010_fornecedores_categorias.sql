-- Tabela de categorias por fornecedor (lead time específico)
create table if not exists estoque_fornecedor_categorias (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references estoque_fornecedores(id) on delete cascade,
  tipo_produto text not null check (tipo_produto in ('Tecido', 'Ferragem', 'Acessorio')),
  lead_time_dias integer not null default 7,
  prazo_pagamento_dias integer,
  observacao text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(fornecedor_id, tipo_produto)
);

-- Tabela de descontos por combo (quando compra mais de uma categoria juntas)
create table if not exists estoque_fornecedor_descontos_combo (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references estoque_fornecedores(id) on delete cascade,
  -- Array das categorias que devem estar juntas no pedido pra ativar o desconto
  categorias_combo text[] not null,
  percentual_desconto numeric(5,2) not null check (percentual_desconto > 0 and percentual_desconto <= 100),
  valor_minimo_pedido numeric(10,2),
  observacao text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices pra performance
create index if not exists idx_fornec_categ_fornecedor on estoque_fornecedor_categorias(fornecedor_id);
create index if not exists idx_fornec_descontos_fornecedor on estoque_fornecedor_descontos_combo(fornecedor_id);

-- View que retorna o "lead time efetivo" pra usar em cálculos:
-- Se a categoria existe na tabela específica, usa ela
-- Senão, fallback pro prazo_entrega_dias geral do fornecedor
create or replace view estoque_vw_fornecedor_lead_time_efetivo as
select
  f.id as fornecedor_id,
  f.nome as fornecedor_nome,
  tipos.tipo as tipo_produto,
  coalesce(fc.lead_time_dias, f.prazo_entrega_dias, 7) as lead_time_efetivo_dias,
  coalesce(fc.prazo_pagamento_dias, null) as prazo_pagamento_dias,
  case
    when fc.id is not null then 'especifico'
    else 'geral_fornecedor'
  end as origem_lead_time
from estoque_fornecedores f
cross join (
  select distinct ec.tipo
  from estoque_categorias ec
  join estoque_produtos p on p.categoria_id = ec.id
  where p.ativo = true
) tipos
left join estoque_fornecedor_categorias fc on fc.fornecedor_id = f.id and fc.tipo_produto = tipos.tipo and fc.ativo = true
where f.ativo = true;

-- Função utilitária pra calcular desconto aplicável num pedido
create or replace function estoque_calcular_desconto_combo(
  p_fornecedor_id uuid,
  p_categorias_pedido text[],
  p_valor_pedido numeric
)
returns table(
  desconto_id uuid,
  percentual numeric,
  valor_desconto numeric,
  observacao text
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.percentual_desconto,
    round(p_valor_pedido * (d.percentual_desconto / 100), 2),
    d.observacao
  from estoque_fornecedor_descontos_combo d
  where d.fornecedor_id = p_fornecedor_id
    and d.ativo = true
    and d.categorias_combo <@ p_categorias_pedido
    and array_length(d.categorias_combo, 1) <= array_length(p_categorias_pedido, 1)
    and (d.valor_minimo_pedido is null or p_valor_pedido >= d.valor_minimo_pedido)
  order by d.percentual_desconto desc
  limit 1;
end $$;

grant select on estoque_fornecedor_categorias to authenticated;
grant insert, update, delete on estoque_fornecedor_categorias to authenticated;
grant select on estoque_fornecedor_descontos_combo to authenticated;
grant insert, update, delete on estoque_fornecedor_descontos_combo to authenticated;
grant select on estoque_vw_fornecedor_lead_time_efetivo to authenticated;
grant execute on function estoque_calcular_desconto_combo(uuid, text[], numeric) to authenticated;
