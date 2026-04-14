-- =============================================================
-- Migration 0003 — Estoque Fase 1: Função estoque_recalcular_abc
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES:
--
--   A função fn_recalcular_abc() existente (setup_estoque.sql) usa
--   estoque_movimentacoes + Pareto 20/30/50 por quantidade e retorna
--   void. É mantida para compatibilidade com o hook existente.
--
--   Esta nova função estoque_recalcular_abc() usa estoque_venda_itens
--   + estoque_vendas, Pareto 80/15/5 por valor monetário, retorna
--   uma tabela com contadores por classe.
--
--   O CHECK constraint da coluna classificacao_abc precisou ser
--   atualizado para incluir 'sem_dados' (o valor de reset).
--
-- =============================================================

-- -------------------------------------------------------------
-- 1. Atualizar CHECK constraint — adicionar 'sem_dados'
--    Constraint existente: estoque_produtos_classificacao_abc_check
--    Permitia apenas: 'A', 'B', 'C'
-- -------------------------------------------------------------

ALTER TABLE estoque_produtos
  DROP CONSTRAINT IF EXISTS estoque_produtos_classificacao_abc_check;

ALTER TABLE estoque_produtos
  ADD CONSTRAINT estoque_produtos_classificacao_abc_check
  CHECK (classificacao_abc IN ('A', 'B', 'C', 'sem_dados'));

-- -------------------------------------------------------------
-- 2. Função estoque_recalcular_abc()
--
-- Pareto 80/15/5 baseado em valor total vendido (últimos 90 dias).
-- Usa window function sum() over (...) para calcular acumulado.
-- Retorna: total_classificados, classe_a, classe_b, classe_c.
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION estoque_recalcular_abc()
RETURNS TABLE (
  total_classificados INT,
  classe_a            INT,
  classe_b            INT,
  classe_c            INT
)
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  -- 1. Reset: todos os produtos ativos → 'sem_dados'
  UPDATE estoque_produtos
  SET classificacao_abc = 'sem_dados'
  WHERE ativo = true;

  -- 2. Classificar produtos com vendas nos últimos 90 dias
  WITH vendas AS (
    -- Soma o valor vendido por produto no período
    SELECT
      vi.produto_id,
      SUM(vi.subtotal) AS valor_vendido
    FROM estoque_venda_itens vi
    JOIN estoque_vendas v ON v.id = vi.venda_id
    WHERE v.data >= current_date - INTERVAL '90 days'
    GROUP BY vi.produto_id
    HAVING SUM(vi.subtotal) > 0
  ),
  ranked AS (
    -- Calcula valor acumulado (do maior para o menor) e total geral
    SELECT
      produto_id,
      valor_vendido,
      SUM(valor_vendido) OVER (
        ORDER BY valor_vendido DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS valor_acumulado,
      SUM(valor_vendido) OVER () AS valor_total
    FROM vendas
  )
  UPDATE estoque_produtos ep
  SET classificacao_abc = CASE
    WHEN r.valor_acumulado / r.valor_total <= 0.80 THEN 'A'
    WHEN r.valor_acumulado / r.valor_total <= 0.95 THEN 'B'
    ELSE                                                 'C'
  END
  FROM ranked r
  WHERE ep.id = r.produto_id;

  -- 3. Retornar contadores por classe
  RETURN QUERY
  SELECT
    COUNT(*)                                              FILTER (WHERE classificacao_abc IN ('A','B','C')) ::INT AS total_classificados,
    COUNT(*) FILTER (WHERE classificacao_abc = 'A')       ::INT AS classe_a,
    COUNT(*) FILTER (WHERE classificacao_abc = 'B')       ::INT AS classe_b,
    COUNT(*) FILTER (WHERE classificacao_abc = 'C')       ::INT AS classe_c
  FROM estoque_produtos
  WHERE ativo = true;
END;
$$;
