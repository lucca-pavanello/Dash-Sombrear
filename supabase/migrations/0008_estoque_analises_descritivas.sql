-- ─── Migration 0008: Views de análises descritivas de estoque ──────────────────

-- 1. Performance por fornecedor (últimos 90 dias)
create or replace view estoque_vw_performance_fornecedor as
select
  f.id,
  f.nome,
  f.lead_time_medio_dias,
  count(distinct l.id) as total_entradas,
  coalesce(sum(l.quantidade_inicial * l.custo_unitario), 0) as valor_total_comprado,
  coalesce(avg(l.custo_unitario), 0) as custo_unitario_medio,
  count(distinct p.id) as produtos_fornecidos
from estoque_fornecedores f
left join estoque_produtos p on p.fornecedor_id = f.id
left join estoque_lotes l on l.produto_id = p.id and l.created_at >= current_date - interval '90 days'
where f.ativo = true
group by f.id, f.nome, f.lead_time_medio_dias
order by valor_total_comprado desc;

-- 2. Performance por categoria/tipo
create or replace view estoque_vw_performance_categoria as
select
  p.tipo as categoria,
  count(distinct p.id) as total_produtos,
  sum(p.estoque_atual * p.custo_medio) as valor_em_estoque,
  coalesce(sum(vi.quantidade), 0) as unidades_vendidas_90d,
  coalesce(sum(vi.subtotal), 0) as valor_vendido_90d,
  coalesce(avg(vi.subtotal / nullif(vi.quantidade, 0)), 0) as ticket_medio
from estoque_produtos p
left join estoque_venda_itens vi on vi.produto_id = p.id
left join estoque_vendas v on v.id = vi.venda_id and v.data >= current_date - interval '90 days'
where p.ativo = true
group by p.tipo
order by valor_vendido_90d desc;

-- 3. Performance por localização (últimos 90 dias)
create or replace view estoque_vw_performance_localizacao as
select
  loc.id,
  loc.codigo,
  loc.setor,
  loc.nivel_acesso,
  count(distinct p.id) as total_produtos,
  sum(p.estoque_atual * p.custo_medio) as valor_em_estoque,
  coalesce(sum(vi.subtotal), 0) as valor_vendido_90d,
  coalesce(sum(vi.quantidade), 0) as unidades_vendidas_90d
from estoque_localizacoes loc
left join estoque_produtos p on p.localizacao_id = loc.id
left join estoque_venda_itens vi on vi.produto_id = p.id
left join estoque_vendas v on v.id = vi.venda_id and v.data >= current_date - interval '90 days'
where loc.ativo = true
group by loc.id, loc.codigo, loc.setor, loc.nivel_acesso
order by valor_vendido_90d desc;

-- 4. Sazonalidade (últimos 12 meses)
create or replace view estoque_vw_sazonalidade as
select
  date_trunc('month', v.data) as mes,
  to_char(v.data, 'TMMonth') as mes_nome,
  extract(month from v.data) as mes_numero,
  extract(year from v.data) as ano,
  count(distinct v.id) as total_vendas,
  coalesce(sum(vi.subtotal), 0) as faturamento,
  coalesce(sum(vi.quantidade), 0) as unidades_vendidas,
  coalesce(avg(vi.subtotal / nullif(vi.quantidade, 0)), 0) as ticket_medio
from estoque_vendas v
left join estoque_venda_itens vi on vi.venda_id = v.id
where v.data >= current_date - interval '12 months'
group by date_trunc('month', v.data), to_char(v.data, 'TMMonth'), extract(month from v.data), extract(year from v.data)
order by mes asc;
