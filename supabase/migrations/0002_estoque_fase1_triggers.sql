-- =============================================================
-- Migration 0002 — Estoque Fase 1: Triggers de consistência
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES / O QUE FOI PULADO:
--
-- O prompt especifica 3 triggers. As tabelas reais diferem do spec:
--
--   TRIGGER 1 — o prompt pede disparo em estoque_lotes, mas a tabela
--   existente não tem produto_id nem quantidade_inicial. Esses campos
--   estão em estoque_lote_itens. O trigger de movimentação de entrada
--   (trg_lote_item_movimentacao) e o decremento/incremento de saldo
--   (trg_mov_estoque) já existem em setup_estoque.sql.
--   Este arquivo acrescenta apenas o que faltava: atualização do
--   custo_unitario como média ponderada (custo_medio no spec).
--
--   TRIGGER 2 — o decremento de estoque_atual (→ quantidade_atual)
--   já é feito pelo trg_mov_estoque existente ao receber um INSERT
--   tipo='saida' em estoque_movimentacoes. Este trigger apenas insere
--   a linha em estoque_movimentacoes ao registrar um item de venda —
--   o decremento acontece automaticamente em cascata.
--
--   TRIGGER 3 — novo; recalcula estoque_vendas.total.
--
--   Nomes de coluna reais usados (diferem do spec):
--     estoque_produtos.quantidade_atual   (spec: estoque_atual)
--     estoque_produtos.custo_unitario     (spec: custo_medio)
--     estoque_movimentacoes.responsavel   (TEXT NOT NULL, obrigatório)
--     estoque_movimentacoes.quantidade_anterior (NUMERIC, obrigatório)
--
-- =============================================================

-- -------------------------------------------------------------
-- TRIGGER 1 — custo médio ponderado ao inserir item de lote
--
-- Dispara em: estoque_lote_itens AFTER INSERT
-- Ordem alfabética entre os triggers existentes:
--   trg_lote_atualiza_total   (a < i)
--   trg_lote_item_custo_medio  ← este (c < m)
--   trg_lote_item_movimentacao (lê quantidade_atual já incrementada
--                               pelo trg_mov_estoque, mas o custo
--                               precisa do valor PRÉ-incremento)
--
-- Resultado: custo_medio é calculado com o estoque antigo (correto).
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION _lote_item_atualiza_custo_medio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qtd_atual   NUMERIC(12,3);
  v_custo_atual NUMERIC(10,4);
BEGIN
  SELECT
    COALESCE(quantidade_atual, 0),
    COALESCE(custo_unitario, 0)
  INTO v_qtd_atual, v_custo_atual
  FROM estoque_produtos
  WHERE id = NEW.produto_id;

  IF v_qtd_atual = 0 THEN
    -- Caso especial: estoque zerado → custo vira direto o do lote
    UPDATE estoque_produtos
    SET custo_unitario = NEW.custo_unitario,
        updated_at     = timezone('utc', now())
    WHERE id = NEW.produto_id;
  ELSE
    -- Média ponderada
    UPDATE estoque_produtos
    SET custo_unitario = (
          (v_custo_atual * v_qtd_atual + NEW.custo_unitario * NEW.quantidade)
          / (v_qtd_atual + NEW.quantidade)
        ),
        updated_at = timezone('utc', now())
    WHERE id = NEW.produto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lote_item_custo_medio ON estoque_lote_itens;
CREATE TRIGGER trg_lote_item_custo_medio
  AFTER INSERT ON estoque_lote_itens
  FOR EACH ROW EXECUTE FUNCTION _lote_item_atualiza_custo_medio();

-- -------------------------------------------------------------
-- TRIGGER 2 — inserção de item de venda → movimentação de saída
--
-- Dispara em: estoque_venda_itens AFTER INSERT
-- Apenas insere em estoque_movimentacoes (tipo='saida').
-- O trg_mov_estoque existente cuida do decremento de quantidade_atual.
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION _venda_item_to_movimentacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qtd_anterior NUMERIC(12,3);
  v_responsavel  TEXT;
  v_user_id      UUID;
BEGIN
  -- Snapshot do estoque antes da saída
  SELECT COALESCE(quantidade_atual, 0)
  INTO v_qtd_anterior
  FROM estoque_produtos
  WHERE id = NEW.produto_id;

  -- Responsável a partir do vendedor da venda
  SELECT
    COALESCE(p.full_name, 'Sistema'),
    v.vendedor_id
  INTO v_responsavel, v_user_id
  FROM estoque_vendas v
  LEFT JOIN profiles p ON p.id = v.vendedor_id
  WHERE v.id = NEW.venda_id;

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
    'Venda ' || NEW.venda_id::text
  );

  -- O trg_mov_estoque dispara automaticamente e faz:
  --   quantidade_atual -= NEW.quantidade

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venda_item_movimentacao ON estoque_venda_itens;
CREATE TRIGGER trg_venda_item_movimentacao
  AFTER INSERT ON estoque_venda_itens
  FOR EACH ROW EXECUTE FUNCTION _venda_item_to_movimentacao();

-- -------------------------------------------------------------
-- TRIGGER 3 — recalcula estoque_vendas.total após cada item
--
-- Dispara em: estoque_venda_itens AFTER INSERT OR UPDATE OR DELETE
-- Usa COALESCE(NEW.venda_id, OLD.venda_id) para cobrir DELETE.
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION _venda_recalcula_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venda_id UUID;
BEGIN
  v_venda_id := COALESCE(NEW.venda_id, OLD.venda_id);

  UPDATE estoque_vendas
  SET total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM estoque_venda_itens
    WHERE venda_id = v_venda_id
  )
  WHERE id = v_venda_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_venda_recalcula_total ON estoque_venda_itens;
CREATE TRIGGER trg_venda_recalcula_total
  AFTER INSERT OR UPDATE OR DELETE ON estoque_venda_itens
  FOR EACH ROW EXECUTE FUNCTION _venda_recalcula_total();
