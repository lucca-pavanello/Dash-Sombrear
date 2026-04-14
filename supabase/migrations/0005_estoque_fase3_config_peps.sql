-- =============================================================
-- Migration 0005 — Estoque Fase 3: config + quantidade_restante + função PEPS
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES ao schema real (vs. prompt original Fase 3):
--   - PEPS opera em estoque_lote_itens (não em estoque_lotes)
--   - estoque_lote_itens não tinha quantidade_restante → criamos aqui
--   - Colunas reais: p.codigo (não sku), p.classificacao_abc (não classe_abc)
--   - p.quantidade_atual (não estoque_atual)
-- =============================================================

-- -------------------------------------------------------------
-- 1. Coluna quantidade_restante em estoque_lote_itens
--    Representa quanto ainda resta deste item de lote para PEPS.
--    Inicializado com 'quantidade' (lote intacto, sem consumo histórico).
--    O Passo 5 (reset) vai ajustar para bater com estoque_atual.
-- -------------------------------------------------------------

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

-- -------------------------------------------------------------
-- 2. Tabela de configuração do módulo de estoque
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_config (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  descricao  TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO estoque_config (chave, valor, descricao) VALUES
  ('lead_time_verde_max_dias',   '90',  'Até este valor, lead time saudável'),
  ('lead_time_amarelo_max_dias', '180', 'Até este valor, alerta. Acima, crítico')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE estoque_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON estoque_config
  FOR ALL USING (auth.role() = 'authenticated');

-- -------------------------------------------------------------
-- 3. Função PEPS
--    Assinatura: (p_produto_id uuid, p_quantidade numeric(12,2)) → jsonb
--
--    Comportamento:
--    - Valida sum(quantidade_restante) >= p_quantidade; senão raise exception
--    - Itera estoque_lote_itens order by estoque_lotes.data_entrada asc (PEPS)
--    - Consome min(restante_a_consumir, quantidade_restante_do_item)
--    - Retorna { custo_total, custo_medio_consumido, lotes: [...] }
-- -------------------------------------------------------------

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
  -- Valida estoque disponível consolidado em lotes
  SELECT COALESCE(SUM(li.quantidade_restante), 0) INTO v_disponivel
  FROM estoque_lote_itens li
  WHERE li.produto_id = p_produto_id AND li.quantidade_restante > 0;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION
      'Estoque insuficiente para produto %: disponivel %, solicitado %',
      p_produto_id, v_disponivel, p_quantidade;
  END IF;

  v_restante_a_consumir := p_quantidade;

  -- PEPS: do mais antigo para o mais novo
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
