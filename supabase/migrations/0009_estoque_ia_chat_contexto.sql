-- =============================================================
-- Migration 0009 — IA do Estoque: função estoque_chat_contexto()
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- Retorna snapshot completo do estoque em JSONB para uso pelo chat IA.
-- Sem risco: apenas cria/substitui uma função, não altera tabelas.
--
-- Adaptações ao schema real:
--   sku             → codigo
--   estoque_atual   → quantidade_atual
--   custo_medio     → custo_unitario
--   classe_abc      → classificacao_abc
--   lead_time_dias  → prazo_entrega_dias
--   preco_venda     → coluna não existe, omitida
-- =============================================================

create or replace function estoque_chat_contexto()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_resultado jsonb;
begin
  with
  resumo_geral as (
    select jsonb_build_object(
      'total_produtos_ativos',    count(*),
      'valor_total_estoque',      coalesce(sum(quantidade_atual * custo_unitario), 0),
      'unidades_em_estoque',      coalesce(sum(quantidade_atual), 0),
      'produtos_classe_a',        count(*) filter (where classificacao_abc = 'A'),
      'produtos_classe_b',        count(*) filter (where classificacao_abc = 'B'),
      'produtos_classe_c',        count(*) filter (where classificacao_abc = 'C'),
      'produtos_sem_dados',       count(*) filter (where classificacao_abc = 'sem_dados' or classificacao_abc is null),
      'produtos_sem_localizacao', count(*) filter (where localizacao_id is null)
    ) as data
    from estoque_produtos where ativo = true
  ),
  giro_anual as (
    select jsonb_build_object(
      'giro_reais',          coalesce(giro_reais, 0),
      'estoque_atual_reais', coalesce(estoque_atual_reais, 0),
      'vendas_reais_12m',    coalesce(vendas_reais, 0)
    ) as data
    from estoque_calcular_giro()
  ),
  top_produtos as (
    select jsonb_agg(jsonb_build_object(
      'sku',             codigo,
      'nome',            nome,
      'classificacao_abc', classificacao_abc,
      'estoque_atual',   quantidade_atual,
      'custo_unitario',  custo_unitario
    ) order by quantidade_atual * custo_unitario desc) as data
    from (
      select codigo, nome, classificacao_abc, quantidade_atual, custo_unitario
      from estoque_produtos
      where ativo = true
      order by quantidade_atual * custo_unitario desc
      limit 20
    ) t
  ),
  sugestoes_compra as (
    select jsonb_agg(jsonb_build_object(
      'sku',            codigo,
      'nome',           nome,
      'urgencia',       urgencia,
      'estoque_atual',  quantidade_atual,
      'lec_sugerido',   lec_sugerido,
      'fornecedor_nome', fornecedor_nome
    )) as data
    from estoque_vw_sugestao_compra
    where urgencia != 'ok'
    limit 10
  ),
  produtos_parados as (
    select jsonb_agg(jsonb_build_object(
      'sku',               codigo,
      'nome',              nome,
      'dias_em_estoque',   dias_em_estoque,
      'valor_parado_reais', valor_parado_reais
    )) as data
    from (
      select codigo, nome, dias_em_estoque, valor_parado_reais
      from estoque_vw_lead_time
      where dias_em_estoque > 90 and quantidade_parada > 0
      order by dias_em_estoque desc
      limit 10
    ) t
  ),
  fornecedores as (
    select jsonb_agg(jsonb_build_object(
      'id',             id,
      'nome',           nome,
      'lead_time_dias', prazo_entrega_dias
    )) as data
    from estoque_fornecedores where ativo = true
  ),
  localizacoes as (
    select jsonb_agg(jsonb_build_object(
      'id',           id,
      'codigo',       codigo,
      'setor',        setor,
      'nivel_acesso', nivel_acesso
    )) as data
    from estoque_localizacoes where ativo = true
  ),
  configuracoes as (
    select jsonb_object_agg(chave, valor) as data
    from estoque_config
  )
  select jsonb_build_object(
    'gerado_em',              now(),
    'resumo',                 (select data from resumo_geral),
    'giro',                   (select data from giro_anual),
    'top_produtos_por_valor', coalesce((select data from top_produtos), '[]'::jsonb),
    'sugestoes_compra',       coalesce((select data from sugestoes_compra), '[]'::jsonb),
    'produtos_parados',       coalesce((select data from produtos_parados), '[]'::jsonb),
    'fornecedores',           coalesce((select data from fornecedores), '[]'::jsonb),
    'localizacoes',           coalesce((select data from localizacoes), '[]'::jsonb),
    'configuracoes',          coalesce((select data from configuracoes), '{}'::jsonb)
  ) into v_resultado;

  return v_resultado;
end $$;

grant execute on function estoque_chat_contexto() to authenticated;
