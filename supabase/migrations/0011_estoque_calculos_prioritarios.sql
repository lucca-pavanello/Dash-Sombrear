-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0011 — 4 Cálculos Prioritários do Estoque
-- Cobertura em dias · Margem de contribuição · Capital travado · ROI
-- ══════════════════════════════════════════════════════════════════════════════

-- ━━━ VIEW: COBERTURA EM DIAS + MARGEM DE CONTRIBUIÇÃO POR PRODUTO ━━━━━━━━━━━
-- View única que alimenta os hooks de cobertura e margem (uma query para ambos).
-- Aliases expõem nomes que coincidem com os TypeScript types definidos no front.

create or replace view estoque_vw_cobertura_margem as
with consumo_90d as (
  select
    produto_id,
    sum(quantidade) as qtd_consumida
  from estoque_movimentacoes
  where tipo in ('saida', 'perda', 'ajuste_negativo')
    and created_at >= now() - interval '90 days'
  group by produto_id
)
select
  p.id                                                                       as produto_id,
  p.codigo                                                                   as sku,
  p.nome,
  p.quantidade_atual                                                         as estoque_atual,
  p.custo_unitario                                                           as custo_medio,
  p.preco_venda,
  p.classificacao_abc::text                                                  as classe_abc,
  coalesce(c.qtd_consumida, 0)                                              as consumo_90d,
  case
    when coalesce(c.qtd_consumida, 0) > 0
    then round((p.quantidade_atual / (c.qtd_consumida / 90.0))::numeric, 1)
    else null
  end                                                                        as cobertura_dias,
  case
    when p.preco_venda is not null
     and p.preco_venda > 0
     and p.custo_unitario is not null
    then round(
      ((p.preco_venda - p.custo_unitario) / p.preco_venda * 100)::numeric,
      2
    )
    else null
  end                                                                        as margem_percentual
from estoque_produtos p
left join consumo_90d c on c.produto_id = p.id
where p.ativo = true;

grant select on estoque_vw_cobertura_margem to authenticated;

-- ━━━ FUNÇÃO: CAPITAL TRAVADO EM PRODUTOS PARADOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Soma o valor (R$) de produtos ativos com estoque > 0 e sem saída nos últimos
-- p_dias_minimos dias. Usa subqueries escalares (sem cross join) para evitar
-- multiplicação incorreta de linhas.

create or replace function estoque_fn_capital_travado(p_dias_minimos integer default 90)
returns table (
  total_produtos      integer,
  total_capital_reais numeric,
  por_classe          jsonb
)
language sql stable as $$
  with ultimas_saidas as (
    select produto_id, max(created_at) as ultima_saida
    from estoque_movimentacoes
    where tipo in ('saida', 'perda', 'ajuste_negativo')
    group by produto_id
  ),
  parados as (
    select
      coalesce(p.classificacao_abc::text, 'sem_dados')    as classe,
      p.quantidade_atual * coalesce(p.custo_unitario, 0)  as valor_parado
    from estoque_produtos p
    left join ultimas_saidas us on us.produto_id = p.id
    where p.ativo = true
      and p.quantidade_atual > 0
      and (
        us.ultima_saida is null
        or us.ultima_saida < now() - (p_dias_minimos || ' days')::interval
      )
  )
  select
    (select count(*)::integer                 from parados)  as total_produtos,
    (select coalesce(sum(valor_parado), 0)    from parados)  as total_capital_reais,
    (select jsonb_object_agg(classe, valor_classe)
     from (
       select classe, sum(valor_parado) as valor_classe
       from parados
       group by classe
     ) t
    )                                                        as por_classe;
$$;

grant execute on function estoque_fn_capital_travado(integer) to authenticated;

-- ━━━ FUNÇÃO: ROI DO ESTOQUE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Calcula o lucro bruto dos últimos 90 dias, anualiza (× 365/90) e divide pelo
-- valor atual do estoque para obter o ROI projetado anual.

create or replace function estoque_fn_roi_estoque()
returns table (
  lucro_bruto_90d        numeric,
  lucro_bruto_anualizado numeric,
  valor_estoque_atual    numeric,
  roi_percentual         numeric
)
language sql stable as $$
  with vendas_90d as (
    select
      coalesce(sum(vi.subtotal), 0)                                         as receita,
      coalesce(sum(vi.quantidade * coalesce(p.custo_unitario, 0)), 0)       as custo
    from estoque_venda_itens vi
    join estoque_vendas v   on v.id  = vi.venda_id
    join estoque_produtos p on p.id  = vi.produto_id
    where v.data >= current_date - interval '90 days'
  ),
  estoque_val as (
    select coalesce(sum(quantidade_atual * coalesce(custo_unitario, 0)), 0) as valor
    from estoque_produtos
    where ativo = true
  )
  select
    (v.receita - v.custo)                                                   as lucro_bruto_90d,
    (v.receita - v.custo) * (365.0 / 90)                                   as lucro_bruto_anualizado,
    e.valor                                                                 as valor_estoque_atual,
    case
      when e.valor > 0
      then round(((v.receita - v.custo) * (365.0 / 90) / e.valor * 100)::numeric, 2)
      else 0
    end                                                                     as roi_percentual
  from vendas_90d v, estoque_val e;
$$;

grant execute on function estoque_fn_roi_estoque() to authenticated;
