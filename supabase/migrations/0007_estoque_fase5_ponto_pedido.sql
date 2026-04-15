-- Migration 0007 — Estoque Fase 5: Ponto de Pedido
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
-- Função: estoque_calcular_ponto_pedido(produto_id)
-- View:   estoque_vw_ponto_pedido
--
-- Fórmulas:
--   D  = vendas últimos 90 dias / 90
--   LT = prazo_entrega_dias do fornecedor (default 7)
--   ES = D × LT  (estoque de segurança)
--   PP = (D × LT) + ES  (ponto de pedido = 2 × ES)
--   cobertura_dias = estoque_atual / D
-- =============================================================

-- ------------------------------------------------------------
-- Função: estoque_calcular_ponto_pedido
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION estoque_calcular_ponto_pedido(p_produto_id uuid)
RETURNS TABLE (
  demanda_diaria    numeric(12,4),
  lead_time_dias    int,
  estoque_seguranca numeric(12,2),
  ponto_pedido      numeric(12,2),
  cobertura_dias    numeric(12,2),
  nivel_alerta      text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_d       numeric(12,4) := 0;
  v_lt      int           := 7;
  v_es      numeric(12,2);
  v_pp      numeric(12,2);
  v_cob     numeric(12,2);
  v_nivel   text;
  v_estoque numeric(12,2);
BEGIN
  -- Demanda média diária (últimos 90 dias)
  SELECT coalesce(sum(vi.quantidade), 0) / 90.0
  INTO v_d
  FROM estoque_venda_itens vi
  JOIN estoque_vendas ev ON ev.id = vi.venda_id
  WHERE vi.produto_id = p_produto_id
    AND ev.data >= current_date - 90;

  -- Lead time do fornecedor (prazo_entrega_dias), default 7
  -- Nota: estoque_produtos.fornecedor é TEXT, join via nome
  SELECT coalesce(f.prazo_entrega_dias, 7)
  INTO v_lt
  FROM estoque_produtos p
  LEFT JOIN estoque_fornecedores f ON f.nome = p.fornecedor
  WHERE p.id = p_produto_id;

  v_lt := coalesce(v_lt, 7);

  -- Estoque atual
  SELECT coalesce(quantidade_atual, 0)
  INTO v_estoque
  FROM estoque_produtos
  WHERE id = p_produto_id;

  -- Fórmulas
  v_es  := round((v_d * v_lt)::numeric, 2);
  v_pp  := round((v_d * v_lt + v_es)::numeric, 2);
  v_cob := CASE
             WHEN v_d = 0 THEN 0
             ELSE round((v_estoque / v_d)::numeric, 2)
           END;

  -- Nível de alerta
  IF v_d = 0 THEN
    v_nivel := 'sem_dados';
    v_es    := 0;
    v_pp    := 0;
    v_cob   := 0;
  ELSIF v_estoque <= 0 THEN
    v_nivel := 'ruptura';
  ELSIF v_estoque <= v_es THEN
    v_nivel := 'critico';
  ELSIF v_estoque <= v_pp THEN
    v_nivel := 'atencao';
  ELSE
    v_nivel := 'ok';
  END IF;

  RETURN QUERY SELECT v_d, v_lt, v_es, v_pp, v_cob, v_nivel;
END;
$$;

-- ------------------------------------------------------------
-- View: estoque_vw_ponto_pedido
-- CTE única — sem loop, chama a função por produto
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW estoque_vw_ponto_pedido AS
WITH pp AS (
  SELECT
    p.id                 AS produto_id,
    p.codigo             AS sku,
    p.nome,
    p.classificacao_abc  AS classe_abc,
    p.quantidade_atual   AS estoque_atual,
    f.nome               AS fornecedor_nome,
    (estoque_calcular_ponto_pedido(p.id)).*
  FROM estoque_produtos p
  LEFT JOIN estoque_fornecedores f ON f.nome = p.fornecedor
  WHERE p.ativo = true
)
SELECT *
FROM pp
ORDER BY
  CASE nivel_alerta
    WHEN 'ruptura'   THEN 1
    WHEN 'critico'   THEN 2
    WHEN 'atencao'   THEN 3
    WHEN 'ok'        THEN 4
    WHEN 'sem_dados' THEN 5
    ELSE 6
  END,
  CASE classe_abc
    WHEN 'A'         THEN 1
    WHEN 'B'         THEN 2
    WHEN 'C'         THEN 3
    WHEN 'sem_dados' THEN 4
    ELSE 5
  END,
  estoque_atual ASC;
