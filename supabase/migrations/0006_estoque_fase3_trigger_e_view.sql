-- =============================================================
-- Migration 0006 — Estoque Fase 3: trigger PEPS + view lead time
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES ao schema real:
--   - Drop: trg_venda_item_movimentacao (prompt dizia trg_venda_item_saida)
--   - Drop: _venda_item_to_movimentacao() (prompt dizia estoque_processar_venda_item())
--   - Novo trigger NÃO atualiza quantidade_atual manualmente
--     (trg_mov_estoque já faz isso via INSERT em estoque_movimentacoes)
--   - View usa estoque_lote_itens.quantidade_restante via JOIN com estoque_lotes
--   - Colunas: codigo (não sku), classificacao_abc (não classe_abc)
-- =============================================================

-- -------------------------------------------------------------
-- 1. Remove trigger/função da Fase 1
--    O novo trigger PEPS os substitui completamente.
-- -------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_venda_item_movimentacao ON estoque_venda_itens;
DROP FUNCTION IF EXISTS _venda_item_to_movimentacao();

-- -------------------------------------------------------------
-- 2. Novo trigger PEPS
--
--    Ao inserir em estoque_venda_itens:
--    a) Chama estoque_consumir_peps → valida + atualiza quantidade_restante dos lotes
--    b) Insere 1 linha em estoque_movimentacoes (tipo='saida')
--    c) trg_mov_estoque (existente) dispara automaticamente e decrementa
--       estoque_produtos.quantidade_atual
--
--    Motivo da abordagem (1 movimentacao por item de venda, não por lote):
--    - Mantém compatibilidade com queries existentes do frontend
--    - Rastreio PEPS fica em estoque_lote_itens.quantidade_restante
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION _venda_item_peps()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qtd_anterior NUMERIC(12,3);
  v_responsavel  TEXT;
  v_user_id      UUID;
BEGIN
  -- Snapshot do estoque antes desta saída
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

  -- PEPS: valida estoque disponível em lotes e consome (atualiza quantidade_restante)
  -- Se estoque insuficiente → raise exception → transação inteira faz rollback
  PERFORM estoque_consumir_peps(NEW.produto_id, NEW.quantidade);

  -- Registra movimentação de saída
  -- trg_mov_estoque dispara automaticamente após este INSERT
  -- e decrementa estoque_produtos.quantidade_atual
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

-- -------------------------------------------------------------
-- 3. View de lead time
--
--    Mostra o "tempo parado" de cada produto (dias desde o lote mais antigo
--    com quantidade_restante > 0). Usado no dashboard de demo.
--
--    Colunas:
--      produto_id, codigo, nome, quantidade_atual, classificacao_abc,
--      data_lote_mais_antigo, dias_em_estoque,
--      quantidade_parada (sum restante), valor_parado_reais
-- -------------------------------------------------------------

CREATE OR REPLACE VIEW estoque_vw_lead_time AS
SELECT
  p.id                                                    AS produto_id,
  p.codigo,
  p.nome,
  p.quantidade_atual,
  p.classificacao_abc,
  min(lo.data_entrada)                                    AS data_lote_mais_antigo,
  (current_date - min(lo.data_entrada))::int              AS dias_em_estoque,
  sum(li.quantidade_restante)                             AS quantidade_parada,
  sum(li.quantidade_restante * li.custo_unitario)         AS valor_parado_reais
FROM estoque_produtos p
LEFT JOIN estoque_lote_itens li
       ON li.produto_id = p.id AND li.quantidade_restante > 0
LEFT JOIN estoque_lotes lo ON lo.id = li.lote_id
WHERE p.ativo = true
GROUP BY
  p.id, p.codigo, p.nome, p.quantidade_atual, p.classificacao_abc;
