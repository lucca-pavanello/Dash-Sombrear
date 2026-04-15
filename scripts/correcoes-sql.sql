-- ══════════════════════════════════════════════════════════════════════════════
-- Correções SQL — mudança-46
-- Projeto: nlswyjpjzibuvdsaooyg (Dash Sombrear)
--
-- Instruções: colar este arquivo INTEIRO no SQL Editor do Supabase e executar.
-- Todos os comandos são idempotentes (IF NOT EXISTS / OR REPLACE / ON CONFLICT).
--
-- Seções:
--   B1 — Popular estoque_config com todas as chaves esperadas
--   B2 — Funções: estoque_calcular_giro + estoque_calcular_lec + vw_sugestao_compra
--   B3 — Função PEPS: estoque_consumir_peps
--   B4 — Trigger PEPS + view estoque_vw_lead_time
--   B5 — Migration 0010: categorias e descontos por fornecedor
--   B6 — Migration 0011: cobertura/margem, capital travado, ROI
-- ══════════════════════════════════════════════════════════════════════════════

-- ━━━ B1 — POPULAR estoque_config ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Chaves corretas (o spec original tinha nomes errados — ajustados aqui).
-- ON CONFLICT DO NOTHING: não sobrescreve valores já customizados.

CREATE TABLE IF NOT EXISTS estoque_config (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  descricao  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE estoque_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON estoque_config;
CREATE POLICY "auth_all"
  ON estoque_config FOR ALL
  USING (auth.role() = 'authenticated');

INSERT INTO estoque_config (chave, valor, descricao) VALUES
  ('lead_time_verde_max_dias',      '90',  'Até este valor, lead time saudável (dias)'),
  ('lead_time_amarelo_max_dias',    '180', 'Até este valor, lead time em alerta. Acima: crítico (dias)'),
  ('custo_pedido_reais',            '50',  'Custo médio de emitir um pedido de compra (R$)'),
  ('taxa_custo_estocagem_percent',  '20',  'Taxa anual de custo de estocagem (%)'),
  ('meses_historico_demanda',       '12',  'Meses de histórico para calcular demanda anual')
ON CONFLICT (chave) DO NOTHING;


-- ━━━ B2 — FUNÇÕES: GIRO + LEC + VIEW SUGESTÃO DE COMPRA ━━━━━━━━━━━━━━━━━━━━━
-- Fonte: migration 0004_estoque_fase4_giro_lec.sql
-- NOTA: usa custo_unitario (não custo_medio — o spec original estava errado).

CREATE OR REPLACE FUNCTION estoque_calcular_giro(
  p_data_inicio date DEFAULT current_date - INTERVAL '365 days',
  p_data_fim    date DEFAULT current_date
)
RETURNS TABLE (
  vendas_reais            NUMERIC,
  vendas_unidades         NUMERIC,
  estoque_atual_reais     NUMERIC,
  estoque_atual_unidades  NUMERIC,
  giro_reais              NUMERIC,
  giro_unidades           NUMERIC
)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_vendas_reais           NUMERIC := 0;
  v_vendas_unidades        NUMERIC := 0;
  v_estoque_atual_reais    NUMERIC := 0;
  v_estoque_atual_unidades NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM(vi.subtotal),    0),
    COALESCE(SUM(vi.quantidade),  0)
  INTO v_vendas_reais, v_vendas_unidades
  FROM estoque_venda_itens vi
  JOIN estoque_vendas v ON v.id = vi.venda_id
  WHERE v.data BETWEEN p_data_inicio AND p_data_fim;

  SELECT
    COALESCE(SUM(p.quantidade_atual * COALESCE(p.custo_unitario, 0)), 0),
    COALESCE(SUM(p.quantidade_atual), 0)
  INTO v_estoque_atual_reais, v_estoque_atual_unidades
  FROM estoque_produtos p
  WHERE p.ativo = true;

  RETURN QUERY SELECT
    ROUND(v_vendas_reais,           2) AS vendas_reais,
    ROUND(v_vendas_unidades,        2) AS vendas_unidades,
    ROUND(v_estoque_atual_reais,    2) AS estoque_atual_reais,
    ROUND(v_estoque_atual_unidades, 2) AS estoque_atual_unidades,
    ROUND(v_vendas_reais    / NULLIF(v_estoque_atual_reais,    0), 2) AS giro_reais,
    ROUND(v_vendas_unidades / NULLIF(v_estoque_atual_unidades, 0), 2) AS giro_unidades;
END;
$$;

CREATE OR REPLACE FUNCTION estoque_calcular_lec(p_produto_id uuid)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_custo_pedido NUMERIC;
  v_taxa         NUMERIC;
  v_custo_unit   NUMERIC;
  v_demanda      NUMERIC;
  v_lec          NUMERIC;
BEGIN
  SELECT valor::numeric INTO v_custo_pedido
  FROM estoque_config WHERE chave = 'custo_pedido_reais';

  SELECT valor::numeric / 100.0 INTO v_taxa
  FROM estoque_config WHERE chave = 'taxa_custo_estocagem_percent';

  SELECT COALESCE(custo_unitario, 0) INTO v_custo_unit
  FROM estoque_produtos WHERE id = p_produto_id;

  SELECT COALESCE(SUM(vi.quantidade), 0) INTO v_demanda
  FROM estoque_venda_itens vi
  JOIN estoque_vendas v ON v.id = vi.venda_id
  WHERE vi.produto_id = p_produto_id
    AND v.data >= current_date - INTERVAL '365 days';

  IF v_demanda = 0 OR v_custo_unit = 0 OR v_taxa = 0 THEN
    RETURN 0;
  END IF;

  v_lec := sqrt((2.0 * v_demanda * v_custo_pedido) / (v_custo_unit * v_taxa));
  RETURN ROUND(v_lec, 2);
END;
$$;

CREATE OR REPLACE VIEW estoque_vw_sugestao_compra AS
SELECT
  p.id,
  p.codigo,
  p.nome,
  p.classificacao_abc,
  p.quantidade_atual,
  p.quantidade_minima,
  p.custo_unitario,
  f.id                    AS fornecedor_id,
  COALESCE(f.nome, p.fornecedor) AS fornecedor_nome,
  f.prazo_entrega_dias,
  estoque_calcular_lec(p.id)                          AS lec_sugerido,
  (estoque_calcular_lec(p.id) * p.custo_unitario)     AS custo_estimado,
  GREATEST(p.quantidade_minima - p.quantidade_atual, 0) AS deficit,
  CASE
    WHEN p.quantidade_atual <= 0               THEN 'critico'
    WHEN p.quantidade_atual < p.quantidade_minima THEN 'abaixo_minimo'
    WHEN p.quantidade_atual < (estoque_calcular_lec(p.id) / 2.0) THEN 'atencao'
    ELSE 'ok'
  END AS urgencia
FROM estoque_produtos p
LEFT JOIN estoque_fornecedores f ON f.nome = p.fornecedor
WHERE p.ativo = true
  AND p.classificacao_abc = 'A'
ORDER BY
  CASE
    WHEN p.quantidade_atual <= 0               THEN 1
    WHEN p.quantidade_atual < p.quantidade_minima THEN 2
    WHEN p.quantidade_atual < (estoque_calcular_lec(p.id) / 2.0) THEN 3
    ELSE 4
  END,
  p.quantidade_atual ASC;


-- ━━━ B3 — FUNÇÃO PEPS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Fonte: migration 0005_estoque_fase3_config_peps.sql
-- Pré-requisito: coluna quantidade_restante em estoque_lote_itens.

ALTER TABLE estoque_lote_itens
  ADD COLUMN IF NOT EXISTS quantidade_restante NUMERIC(12,3);

UPDATE estoque_lote_itens
  SET quantidade_restante = quantidade
  WHERE quantidade_restante IS NULL;

ALTER TABLE estoque_lote_itens
  ALTER COLUMN quantidade_restante SET NOT NULL,
  ALTER COLUMN quantidade_restante SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lote_itens_restante
  ON estoque_lote_itens(produto_id, quantidade_restante)
  WHERE quantidade_restante > 0;

CREATE OR REPLACE FUNCTION estoque_consumir_peps(
  p_produto_id uuid,
  p_quantidade numeric(12,2)
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_disponivel          numeric(12,3);
  v_restante_a_consumir numeric(12,3);
  v_lotes               jsonb := '[]'::jsonb;
  v_custo_total         numeric(12,2) := 0;
  l                     record;
  v_consumir            numeric(12,3);
BEGIN
  SELECT COALESCE(SUM(li.quantidade_restante), 0) INTO v_disponivel
  FROM estoque_lote_itens li
  WHERE li.produto_id = p_produto_id AND li.quantidade_restante > 0;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION
      'Estoque insuficiente para produto %: disponivel %, solicitado %',
      p_produto_id, v_disponivel, p_quantidade;
  END IF;

  v_restante_a_consumir := p_quantidade;

  FOR l IN
    SELECT li.id, li.quantidade_restante, li.custo_unitario
    FROM estoque_lote_itens li
    JOIN estoque_lotes lo ON lo.id = li.lote_id
    WHERE li.produto_id = p_produto_id AND li.quantidade_restante > 0
    ORDER BY lo.data_entrada ASC, li.created_at ASC
  LOOP
    EXIT WHEN v_restante_a_consumir <= 0;

    v_consumir := LEAST(v_restante_a_consumir, l.quantidade_restante);

    UPDATE estoque_lote_itens
      SET quantidade_restante = quantidade_restante - v_consumir
      WHERE id = l.id;

    v_custo_total := v_custo_total + v_consumir * COALESCE(l.custo_unitario, 0);

    v_lotes := v_lotes || jsonb_build_object(
      'lote_item_id',   l.id,
      'quantidade',     v_consumir,
      'custo_unitario', l.custo_unitario
    );

    v_restante_a_consumir := v_restante_a_consumir - v_consumir;
  END LOOP;

  RETURN jsonb_build_object(
    'custo_total',           v_custo_total,
    'custo_medio_consumido', CASE WHEN p_quantidade > 0
                               THEN round(v_custo_total / p_quantidade, 2)
                               ELSE 0 END,
    'lotes', v_lotes
  );
END $$;


-- ━━━ B4 — TRIGGER PEPS + VIEW LEAD TIME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Fonte: migration 0006_estoque_fase3_trigger_e_view.sql

DROP TRIGGER IF EXISTS trg_venda_item_movimentacao ON estoque_venda_itens;
DROP FUNCTION IF EXISTS _venda_item_to_movimentacao();

CREATE OR REPLACE FUNCTION _venda_item_peps()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qtd_anterior NUMERIC(12,3);
  v_responsavel  TEXT;
  v_user_id      UUID;
BEGIN
  SELECT COALESCE(quantidade_atual, 0)
  INTO v_qtd_anterior
  FROM estoque_produtos
  WHERE id = NEW.produto_id;

  SELECT
    COALESCE(p.full_name, 'Sistema'),
    v.vendedor_id
  INTO v_responsavel, v_user_id
  FROM estoque_vendas v
  LEFT JOIN profiles p ON p.id = v.vendedor_id
  WHERE v.id = NEW.venda_id;

  PERFORM estoque_consumir_peps(NEW.produto_id, NEW.quantidade);

  INSERT INTO estoque_movimentacoes (
    produto_id,
    tipo,
    quantidade,
    quantidade_anterior,
    custo_unitario,
    user_id,
    responsavel,
    motivo
  ) VALUES (
    NEW.produto_id,
    'saida',
    NEW.quantidade,
    v_qtd_anterior,
    NEW.preco_unitario,
    v_user_id,
    COALESCE(v_responsavel, 'Sistema'),
    'Venda PEPS ' || NEW.venda_id::text
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_venda_item_movimentacao_peps ON estoque_venda_itens;
CREATE TRIGGER trg_venda_item_movimentacao_peps
  AFTER INSERT ON estoque_venda_itens
  FOR EACH ROW EXECUTE FUNCTION _venda_item_peps();

DROP VIEW IF EXISTS estoque_vw_lead_time;
CREATE VIEW estoque_vw_lead_time AS
SELECT
  p.id                                                    AS produto_id,
  p.codigo,
  p.nome,
  p.quantidade_atual,
  p.classificacao_abc,
  ec.tipo                                                 AS tipo,
  min(lo.data_entrada)                                    AS data_lote_mais_antigo,
  (current_date - min(lo.data_entrada))::int              AS dias_em_estoque,
  sum(li.quantidade_restante)                             AS quantidade_parada,
  sum(li.quantidade_restante * li.custo_unitario)         AS valor_parado_reais
FROM estoque_produtos p
LEFT JOIN estoque_categorias ec ON ec.id = p.categoria_id
LEFT JOIN estoque_lote_itens li
       ON li.produto_id = p.id AND li.quantidade_restante > 0
LEFT JOIN estoque_lotes lo ON lo.id = li.lote_id
WHERE p.ativo = true
GROUP BY
  p.id, p.codigo, p.nome, p.quantidade_atual, p.classificacao_abc, ec.tipo;


-- ━━━ B5 — MIGRATION 0010: CATEGORIAS E DESCONTOS POR FORNECEDOR ━━━━━━━━━━━━━━
-- Fonte: migration 0010_fornecedores_categorias.sql

CREATE TABLE IF NOT EXISTS estoque_fornecedor_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES estoque_fornecedores(id) ON DELETE CASCADE,
  tipo_produto TEXT NOT NULL CHECK (tipo_produto IN ('Tecido', 'Ferragem', 'Acessorio')),
  lead_time_dias INTEGER NOT NULL DEFAULT 7,
  prazo_pagamento_dias INTEGER,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fornecedor_id, tipo_produto)
);

CREATE TABLE IF NOT EXISTS estoque_fornecedor_descontos_combo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES estoque_fornecedores(id) ON DELETE CASCADE,
  categorias_combo TEXT[] NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL CHECK (percentual_desconto > 0 AND percentual_desconto <= 100),
  valor_minimo_pedido NUMERIC(10,2),
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornec_categ_fornecedor ON estoque_fornecedor_categorias(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornec_descontos_fornecedor ON estoque_fornecedor_descontos_combo(fornecedor_id);

CREATE OR REPLACE VIEW estoque_vw_fornecedor_lead_time_efetivo AS
SELECT
  f.id AS fornecedor_id,
  f.nome AS fornecedor_nome,
  p.tipo AS tipo_produto,
  COALESCE(fc.lead_time_dias, f.prazo_entrega_dias, 7) AS lead_time_efetivo_dias,
  COALESCE(fc.prazo_pagamento_dias, NULL) AS prazo_pagamento_dias,
  CASE
    WHEN fc.id IS NOT NULL THEN 'especifico'
    ELSE 'geral_fornecedor'
  END AS origem_lead_time
FROM estoque_fornecedores f
CROSS JOIN (SELECT DISTINCT tipo FROM estoque_produtos WHERE ativo = true) p
LEFT JOIN estoque_fornecedor_categorias fc
  ON fc.fornecedor_id = f.id AND fc.tipo_produto = p.tipo AND fc.ativo = true
WHERE f.ativo = true;

CREATE OR REPLACE FUNCTION estoque_calcular_desconto_combo(
  p_fornecedor_id uuid,
  p_categorias_pedido text[],
  p_valor_pedido numeric
)
RETURNS TABLE(
  desconto_id uuid,
  percentual numeric,
  valor_desconto numeric,
  observacao text
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.percentual_desconto,
    ROUND(p_valor_pedido * (d.percentual_desconto / 100), 2),
    d.observacao
  FROM estoque_fornecedor_descontos_combo d
  WHERE d.fornecedor_id = p_fornecedor_id
    AND d.ativo = true
    AND d.categorias_combo <@ p_categorias_pedido
    AND array_length(d.categorias_combo, 1) <= array_length(p_categorias_pedido, 1)
    AND (d.valor_minimo_pedido IS NULL OR p_valor_pedido >= d.valor_minimo_pedido)
  ORDER BY d.percentual_desconto DESC
  LIMIT 1;
END $$;

GRANT SELECT ON estoque_fornecedor_categorias TO authenticated;
GRANT INSERT, UPDATE, DELETE ON estoque_fornecedor_categorias TO authenticated;
GRANT SELECT ON estoque_fornecedor_descontos_combo TO authenticated;
GRANT INSERT, UPDATE, DELETE ON estoque_fornecedor_descontos_combo TO authenticated;
GRANT SELECT ON estoque_vw_fornecedor_lead_time_efetivo TO authenticated;
GRANT EXECUTE ON FUNCTION estoque_calcular_desconto_combo(uuid, text[], numeric) TO authenticated;


-- ━━━ B6 — MIGRATION 0011: COBERTURA/MARGEM, CAPITAL TRAVADO, ROI ━━━━━━━━━━━━━
-- Fonte: migration 0011_estoque_calculos_prioritarios.sql

CREATE OR REPLACE VIEW estoque_vw_cobertura_margem AS
WITH consumo_90d AS (
  SELECT
    produto_id,
    SUM(quantidade) AS qtd_consumida
  FROM estoque_movimentacoes
  WHERE tipo IN ('saida', 'perda', 'ajuste_negativo')
    AND created_at >= NOW() - INTERVAL '90 days'
  GROUP BY produto_id
)
SELECT
  p.id                                                                       AS produto_id,
  p.codigo                                                                   AS sku,
  p.nome,
  p.quantidade_atual                                                         AS estoque_atual,
  p.custo_unitario                                                           AS custo_medio,
  p.preco_venda,
  p.classificacao_abc::text                                                  AS classe_abc,
  COALESCE(c.qtd_consumida, 0)                                              AS consumo_90d,
  CASE
    WHEN COALESCE(c.qtd_consumida, 0) > 0
    THEN ROUND((p.quantidade_atual / (c.qtd_consumida / 90.0))::numeric, 1)
    ELSE NULL
  END                                                                        AS cobertura_dias,
  CASE
    WHEN p.preco_venda IS NOT NULL
     AND p.preco_venda > 0
     AND p.custo_unitario IS NOT NULL
    THEN ROUND(
      ((p.preco_venda - p.custo_unitario) / p.preco_venda * 100)::numeric,
      2
    )
    ELSE NULL
  END                                                                        AS margem_percentual
FROM estoque_produtos p
LEFT JOIN consumo_90d c ON c.produto_id = p.id
WHERE p.ativo = true;

GRANT SELECT ON estoque_vw_cobertura_margem TO authenticated;

CREATE OR REPLACE FUNCTION estoque_fn_capital_travado(p_dias_minimos integer DEFAULT 90)
RETURNS TABLE (
  total_produtos      integer,
  total_capital_reais numeric,
  por_classe          jsonb
)
LANGUAGE sql STABLE AS $$
  WITH ultimas_saidas AS (
    SELECT produto_id, MAX(created_at) AS ultima_saida
    FROM estoque_movimentacoes
    WHERE tipo IN ('saida', 'perda', 'ajuste_negativo')
    GROUP BY produto_id
  ),
  parados AS (
    SELECT
      COALESCE(p.classificacao_abc::text, 'sem_dados')    AS classe,
      p.quantidade_atual * COALESCE(p.custo_unitario, 0)  AS valor_parado
    FROM estoque_produtos p
    LEFT JOIN ultimas_saidas us ON us.produto_id = p.id
    WHERE p.ativo = true
      AND p.quantidade_atual > 0
      AND (
        us.ultima_saida IS NULL
        OR us.ultima_saida < NOW() - (p_dias_minimos || ' days')::interval
      )
  )
  SELECT
    (SELECT COUNT(*)::integer              FROM parados)  AS total_produtos,
    (SELECT COALESCE(SUM(valor_parado), 0) FROM parados)  AS total_capital_reais,
    (SELECT jsonb_object_agg(classe, valor_classe)
     FROM (
       SELECT classe, SUM(valor_parado) AS valor_classe
       FROM parados
       GROUP BY classe
     ) t
    )                                                     AS por_classe;
$$;

GRANT EXECUTE ON FUNCTION estoque_fn_capital_travado(integer) TO authenticated;

CREATE OR REPLACE FUNCTION estoque_fn_roi_estoque()
RETURNS TABLE (
  lucro_bruto_90d        numeric,
  lucro_bruto_anualizado numeric,
  valor_estoque_atual    numeric,
  roi_percentual         numeric
)
LANGUAGE sql STABLE AS $$
  WITH vendas_90d AS (
    SELECT
      COALESCE(SUM(vi.subtotal), 0)                                         AS receita,
      COALESCE(SUM(vi.quantidade * COALESCE(p.custo_unitario, 0)), 0)       AS custo
    FROM estoque_venda_itens vi
    JOIN estoque_vendas v   ON v.id  = vi.venda_id
    JOIN estoque_produtos p ON p.id  = vi.produto_id
    WHERE v.data >= current_date - INTERVAL '90 days'
  ),
  estoque_val AS (
    SELECT COALESCE(SUM(quantidade_atual * COALESCE(custo_unitario, 0)), 0) AS valor
    FROM estoque_produtos
    WHERE ativo = true
  )
  SELECT
    (v.receita - v.custo)                                                   AS lucro_bruto_90d,
    (v.receita - v.custo) * (365.0 / 90)                                   AS lucro_bruto_anualizado,
    e.valor                                                                 AS valor_estoque_atual,
    CASE
      WHEN e.valor > 0
      THEN ROUND(((v.receita - v.custo) * (365.0 / 90) / e.valor * 100)::numeric, 2)
      ELSE 0
    END                                                                     AS roi_percentual
  FROM vendas_90d v, estoque_val e;
$$;

GRANT EXECUTE ON FUNCTION estoque_fn_roi_estoque() TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM — rode npm run auditoria:estoque para verificar o resultado
-- ══════════════════════════════════════════════════════════════════════════════
