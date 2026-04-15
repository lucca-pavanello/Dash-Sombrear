-- =============================================================
-- Migration 0008 — Views de análises descritivas de estoque
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- Adaptações ao schema real (vs. spec original):
--   lead_time_medio_dias  → prazo_entrega_dias (estoque_fornecedores)
--   p.fornecedor_id       → p.fornecedor = f.nome (sem FK, join por texto)
--   estoque_lotes.produto_id → não existe; usar estoque_lote_itens
--   l.quantidade_inicial  → li.quantidade (em estoque_lote_itens)
--   p.tipo                → ec.tipo via JOIN estoque_categorias
--   p.estoque_atual       → p.quantidade_atual
--   p.custo_medio         → p.custo_unitario
-- =============================================================

-- 1. Performance por fornecedor (últimos 90 dias)
create or replace view estoque_vw_performance_fornecedor as
select
  f.id,
  f.nome,
  f.prazo_entrega_dias                                  as lead_time_medio_dias,
  count(distinct lo.id)                                 as total_entradas,
  coalesce(sum(li.quantidade * li.custo_unitario), 0)   as valor_total_comprado,
  coalesce(avg(li.custo_unitario), 0)                   as custo_unitario_medio,
  count(distinct p.id)                                  as produtos_fornecidos
from estoque_fornecedores f
left join estoque_produtos p    on p.fornecedor = f.nome
left join estoque_lote_itens li on li.produto_id = p.id
left join estoque_lotes lo      on lo.id = li.lote_id
                                and lo.data_entrada >= current_date - interval '90 days'
where f.ativo = true
group by f.id, f.nome, f.prazo_entrega_dias
order by valor_total_comprado desc;

-- 2. Performance por categoria/tipo (últimos 90 dias)
create or replace view estoque_vw_performance_categoria as
select
  ec.tipo                                                     as categoria,
  count(distinct p.id)                                        as total_produtos,
  sum(p.quantidade_atual * p.custo_unitario)                  as valor_em_estoque,
  coalesce(sum(vi.quantidade), 0)                             as unidades_vendidas_90d,
  coalesce(sum(vi.subtotal), 0)                               as valor_vendido_90d,
  coalesce(avg(vi.subtotal / nullif(vi.quantidade, 0)), 0)    as ticket_medio
from estoque_produtos p
left join estoque_categorias ec   on ec.id = p.categoria_id
left join estoque_venda_itens vi  on vi.produto_id = p.id
left join estoque_vendas v        on v.id = vi.venda_id
                                  and v.data >= current_date - interval '90 days'
where p.ativo = true
group by ec.tipo
order by valor_vendido_90d desc;

-- 3. Performance por localização (últimos 90 dias)
create or replace view estoque_vw_performance_localizacao as
select
  loc.id,
  loc.codigo,
  loc.setor,
  loc.nivel_acesso,
  count(distinct p.id)                              as total_produtos,
  sum(p.quantidade_atual * p.custo_unitario)        as valor_em_estoque,
  coalesce(sum(vi.subtotal), 0)                     as valor_vendido_90d,
  coalesce(sum(vi.quantidade), 0)                   as unidades_vendidas_90d
from estoque_localizacoes loc
left join estoque_produtos p      on p.localizacao_id = loc.id
left join estoque_venda_itens vi  on vi.produto_id = p.id
left join estoque_vendas v        on v.id = vi.venda_id
                                  and v.data >= current_date - interval '90 days'
where loc.ativo = true
group by loc.id, loc.codigo, loc.setor, loc.nivel_acesso
order by valor_vendido_90d desc;

-- 4. Sazonalidade (últimos 12 meses)
create or replace view estoque_vw_sazonalidade as
select
  date_trunc('month', v.data)                               as mes,
  to_char(v.data, 'TMMonth')                                as mes_nome,
  extract(month from v.data)                                as mes_numero,
  extract(year from v.data)                                 as ano,
  count(distinct v.id)                                      as total_vendas,
  coalesce(sum(vi.subtotal), 0)                             as faturamento,
  coalesce(sum(vi.quantidade), 0)                           as unidades_vendidas,
  coalesce(avg(vi.subtotal / nullif(vi.quantidade, 0)), 0)  as ticket_medio
from estoque_vendas v
left join estoque_venda_itens vi on vi.venda_id = v.id
where v.data >= current_date - interval '12 months'
group by
  date_trunc('month', v.data),
  to_char(v.data, 'TMMonth'),
  extract(month from v.data),
  extract(year from v.data)
order by mes asc;
