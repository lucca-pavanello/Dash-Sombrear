-- =============================================================
-- Migration 0004 — Estoque Fase 4: Giro + LEC + View Sugestão de Compra
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES vs. spec original:
--
--   estoque_config  — tabela não existia; criada aqui
--   classe_abc      — coluna real: classificacao_abc
--   estoque_atual   — coluna real: quantidade_atual
--   custo_medio     — coluna real: custo_unitario
--   estoque_minimo  — coluna real: quantidade_minima
--   sku             — coluna real: codigo
--   fornecedor_id   — não existe FK; estoque_produtos.fornecedor é TEXT
--                     view usa LEFT JOIN ON f.nome = p.fornecedor
--   lead_time_medio_dias — coluna real: prazo_entrega_dias
--
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tabela estoque_config
-- -------------------------------------------------------------

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

-- -------------------------------------------------------------
-- 2. Configurações padrão
-- -------------------------------------------------------------

INSERT INTO estoque_config (chave, valor, descricao) VALUES
  ('custo_pedido_reais',          '50.00', 'Custo médio de emitir um pedido de compra (R$)'),
  ('taxa_custo_estocagem_percent', '20',   'Taxa anual de custo de estocagem (%)'),
  ('meses_historico_demanda',      '12',   'Meses de histórico para demanda anual')
ON CONFLICT (chave) DO NOTHING;

-- -------------------------------------------------------------
-- 3. Função estoque_calcular_giro
--
-- Retorna: vendas_reais, vendas_unidades, estoque_atual_reais,
--          estoque_atual_unidades, giro_reais, giro_unidades
-- -------------------------------------------------------------

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
  -- Vendas no período
  SELECT
    COALESCE(SUM(vi.subtotal),    0),
    COALESCE(SUM(vi.quantidade),  0)
  INTO v_vendas_reais, v_vendas_unidades
  FROM estoque_venda_itens vi
  JOIN estoque_vendas v ON v.id = vi.venda_id
  WHERE v.data BETWEEN p_data_inicio AND p_data_fim;

  -- Estoque atual (todos os produtos ativos)
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

-- -------------------------------------------------------------
-- 4. Função estoque_calcular_lec
--
-- Fórmula: LEC = sqrt( (2 × D × O) / (p × H) )
--   D = demanda anual (unidades)
--   O = custo_pedido_reais
--   p = custo_unitario do produto
--   H = taxa_custo_estocagem (0 a 1)
-- -------------------------------------------------------------

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
  -- Parâmetros da config
  SELECT valor::numeric INTO v_custo_pedido
  FROM estoque_config WHERE chave = 'custo_pedido_reais';

  SELECT valor::numeric / 100.0 INTO v_taxa
  FROM estoque_config WHERE chave = 'taxa_custo_estocagem_percent';

  -- Custo unitário do produto
  SELECT COALESCE(custo_unitario, 0) INTO v_custo_unit
  FROM estoque_produtos WHERE id = p_produto_id;

  -- Demanda anual: soma das quantidades vendidas nos últimos 365 dias
  SELECT COALESCE(SUM(vi.quantidade), 0) INTO v_demanda
  FROM estoque_venda_itens vi
  JOIN estoque_vendas v ON v.id = vi.venda_id
  WHERE vi.produto_id = p_produto_id
    AND v.data >= current_date - INTERVAL '365 days';

  -- Guarda-chuva: se sem dados, retorna 0
  IF v_demanda = 0 OR v_custo_unit = 0 OR v_taxa = 0 THEN
    RETURN 0;
  END IF;

  v_lec := sqrt((2.0 * v_demanda * v_custo_pedido) / (v_custo_unit * v_taxa));
  RETURN ROUND(v_lec, 2);
END;
$$;

-- -------------------------------------------------------------
-- 5. View estoque_vw_sugestao_compra
--
-- Mostra apenas produtos classe A ativos, com LEC e urgência.
-- JOIN em fornecedores via texto (p.fornecedor = f.nome).
-- -------------------------------------------------------------

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
