-- ============================================================
-- Módulo de Estoque — Sombrear
-- Executar no Supabase SQL Editor (projeto: nlswyjpjzibuvdsaooyg)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelas
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  nome       TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('tecido', 'acessorio', 'ferragem', 'outro'))
);

CREATE TABLE IF NOT EXISTS estoque_produtos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  nome              TEXT NOT NULL,
  codigo            TEXT UNIQUE,
  categoria_id      UUID NOT NULL REFERENCES estoque_categorias(id) ON DELETE RESTRICT,
  unidade           TEXT NOT NULL CHECK (unidade IN ('m', 'm2', 'un', 'kg')),
  largura_padrao_cm NUMERIC(10,2),
  quantidade_atual  NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantidade_minima NUMERIC(12,3) NOT NULL DEFAULT 0,
  custo_unitario    NUMERIC(10,4),
  fornecedor        TEXT,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  observacoes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_estoque_produtos_categoria ON estoque_produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_estoque_produtos_ativo     ON estoque_produtos(ativo);

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  produto_id          UUID NOT NULL REFERENCES estoque_produtos(id) ON DELETE RESTRICT,
  tipo                TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'perda')),
  -- Para entrada/saida/perda: quantidade movimentada (positivo)
  -- Para ajuste: valor FINAL absoluto desejado do estoque
  quantidade          NUMERIC(12,3) NOT NULL CHECK (quantidade >= 0),
  quantidade_anterior NUMERIC(12,3) NOT NULL, -- snapshot do estoque antes (auditoria)
  orcamento_id        UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
  motivo              TEXT,
  nota_fiscal         TEXT,
  custo_unitario      NUMERIC(10,4),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mov_produto_id  ON estoque_movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_created_at  ON estoque_movimentacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_tipo        ON estoque_movimentacoes(tipo);

-- ------------------------------------------------------------
-- 2. Trigger: atualiza quantidade_atual após cada movimentação
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION _update_estoque_from_movimentacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE estoque_produtos
    SET quantidade_atual = quantidade_atual + NEW.quantidade,
        updated_at = timezone('utc', now())
    WHERE id = NEW.produto_id;

  ELSIF NEW.tipo IN ('saida', 'perda') THEN
    UPDATE estoque_produtos
    SET quantidade_atual = quantidade_atual - NEW.quantidade,
        updated_at = timezone('utc', now())
    WHERE id = NEW.produto_id;

  ELSIF NEW.tipo = 'ajuste' THEN
    -- quantidade = novo valor final absoluto do estoque
    UPDATE estoque_produtos
    SET quantidade_atual = NEW.quantidade,
        updated_at = timezone('utc', now())
    WHERE id = NEW.produto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mov_estoque ON estoque_movimentacoes;
CREATE TRIGGER trg_mov_estoque
  AFTER INSERT ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION _update_estoque_from_movimentacao();

-- ------------------------------------------------------------
-- 3. View de alertas (quantidade_atual <= quantidade_minima)
--    Supabase não permite filtro coluna vs coluna no cliente,
--    então usamos uma view.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW estoque_produtos_alerta AS
  SELECT
    ep.*,
    ec.nome AS categoria_nome,
    ec.tipo AS categoria_tipo
  FROM estoque_produtos ep
  JOIN estoque_categorias ec ON ec.id = ep.categoria_id
  WHERE ep.ativo = true
    AND ep.quantidade_minima > 0
    AND ep.quantidade_atual <= ep.quantidade_minima;

-- ------------------------------------------------------------
-- 4. RPC: top produtos movimentados (últimos 90 dias)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION top_produtos_movimentados(p_limit INT DEFAULT 10)
RETURNS TABLE(
  produto_id     UUID,
  nome           TEXT,
  total_saidas   NUMERIC,
  total_entradas NUMERIC
)
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT
    m.produto_id,
    p.nome,
    SUM(CASE WHEN m.tipo IN ('saida', 'perda') THEN m.quantidade ELSE 0 END) AS total_saidas,
    SUM(CASE WHEN m.tipo = 'entrada'           THEN m.quantidade ELSE 0 END) AS total_entradas
  FROM estoque_movimentacoes m
  JOIN estoque_produtos p ON p.id = m.produto_id
  WHERE m.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY m.produto_id, p.nome
  ORDER BY total_saidas DESC
  LIMIT p_limit;
$$;

-- ------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------

-- estoque_categorias
ALTER TABLE estoque_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_cat_select_aprovados"
  ON estoque_categorias FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_cat_all_admin"
  ON estoque_categorias FOR ALL
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- estoque_produtos
ALTER TABLE estoque_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_prod_select_aprovados"
  ON estoque_produtos FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_prod_insert_aprovados"
  ON estoque_produtos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_prod_update_aprovados"
  ON estoque_produtos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_prod_delete_admin"
  ON estoque_produtos FOR DELETE
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- estoque_movimentacoes (imutável: só INSERT permitido para aprovados)
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_mov_select_aprovados"
  ON estoque_movimentacoes FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_mov_insert_aprovados"
  ON estoque_movimentacoes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

-- Sem UPDATE para ninguém; DELETE apenas admin de emergência
CREATE POLICY "estoque_mov_delete_admin"
  ON estoque_movimentacoes FOR DELETE
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- ------------------------------------------------------------
-- 6. Seeds de categorias iniciais
-- ------------------------------------------------------------

INSERT INTO estoque_categorias (nome, tipo) VALUES
  ('Tecidos Rolo',         'tecido'),
  ('Tecidos Vertical',     'tecido'),
  ('Trilhos e Perfis',     'ferragem'),
  ('Motores',              'acessorio'),
  ('Comandos e Correntes', 'acessorio'),
  ('Suportes e Fixação',   'ferragem'),
  ('Acabamentos',          'acessorio'),
  ('Outros',               'outro')
ON CONFLICT (nome) DO NOTHING;

-- ------------------------------------------------------------
-- 7. Campo classificacao_abc em estoque_produtos
-- ------------------------------------------------------------

ALTER TABLE estoque_produtos
  ADD COLUMN IF NOT EXISTS classificacao_abc TEXT CHECK (classificacao_abc IN ('A', 'B', 'C'));

-- ------------------------------------------------------------
-- 8. Tabela estoque_fornecedores
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_fornecedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  nome                TEXT NOT NULL,
  cnpj                TEXT,
  telefone            TEXT,
  email               TEXT,
  contato             TEXT,
  prazo_entrega_dias  INTEGER,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  observacoes         TEXT
);

-- RLS estoque_fornecedores
ALTER TABLE estoque_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_forn_select_aprovados"
  ON estoque_fornecedores FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_forn_insert_aprovados"
  ON estoque_fornecedores FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_forn_update_aprovados"
  ON estoque_fornecedores FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_forn_delete_admin"
  ON estoque_fornecedores FOR DELETE
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- ------------------------------------------------------------
-- 9. Tabelas estoque_lotes e estoque_lote_itens
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_lotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  fornecedor_id UUID REFERENCES estoque_fornecedores(id) ON DELETE SET NULL,
  nf_numero     TEXT,
  data_entrada  DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes   TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lotes_fornecedor ON estoque_lotes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_lotes_data       ON estoque_lotes(data_entrada DESC);

-- RLS estoque_lotes
ALTER TABLE estoque_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_lotes_select_aprovados"
  ON estoque_lotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_lotes_insert_aprovados"
  ON estoque_lotes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_lotes_update_aprovados"
  ON estoque_lotes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_lotes_delete_admin"
  ON estoque_lotes FOR DELETE
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- Itens do lote
CREATE TABLE IF NOT EXISTS estoque_lote_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  lote_id        UUID NOT NULL REFERENCES estoque_lotes(id) ON DELETE CASCADE,
  produto_id     UUID NOT NULL REFERENCES estoque_produtos(id) ON DELETE RESTRICT,
  quantidade     NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC(10,4) NOT NULL CHECK (custo_unitario >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lote_itens_lote    ON estoque_lote_itens(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_itens_produto ON estoque_lote_itens(produto_id);

-- RLS estoque_lote_itens
ALTER TABLE estoque_lote_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_lote_itens_select_aprovados"
  ON estoque_lote_itens FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_lote_itens_insert_aprovados"
  ON estoque_lote_itens FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "estoque_lote_itens_delete_admin"
  ON estoque_lote_itens FOR DELETE
  USING (auth.jwt() ->> 'email' = 'luccapavanallo@gmail.com');

-- ------------------------------------------------------------
-- 10. Trigger: inserção em estoque_lote_itens → movimentação de entrada
--     O trigger trg_mov_estoque (seção 2) já cuida de atualizar o saldo.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION _lote_item_to_movimentacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_responsavel TEXT;
  v_snapshot    NUMERIC(12,3);
  v_nf          TEXT;
  v_user_id     UUID;
BEGIN
  SELECT
    COALESCE(p.full_name, 'Sistema'),
    l.nf_numero,
    l.user_id
  INTO v_responsavel, v_nf, v_user_id
  FROM estoque_lotes l
  LEFT JOIN profiles p ON p.id = l.user_id
  WHERE l.id = NEW.lote_id;

  SELECT quantidade_atual INTO v_snapshot
  FROM estoque_produtos WHERE id = NEW.produto_id;

  INSERT INTO estoque_movimentacoes (
    produto_id, tipo, quantidade, quantidade_anterior,
    nota_fiscal, custo_unitario, user_id, responsavel, motivo
  ) VALUES (
    NEW.produto_id,
    'entrada',
    NEW.quantidade,
    COALESCE(v_snapshot, 0),
    v_nf,
    NEW.custo_unitario,
    v_user_id,
    COALESCE(v_responsavel, 'Sistema'),
    'Entrada via lote ' || NEW.lote_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lote_item_movimentacao ON estoque_lote_itens;
CREATE TRIGGER trg_lote_item_movimentacao
  AFTER INSERT ON estoque_lote_itens
  FOR EACH ROW EXECUTE FUNCTION _lote_item_to_movimentacao();

-- Trigger: recalcula valor_total do lote após cada item inserido/alterado/removido
CREATE OR REPLACE FUNCTION _lote_atualiza_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lote_id UUID;
BEGIN
  v_lote_id := COALESCE(NEW.lote_id, OLD.lote_id);
  UPDATE estoque_lotes
  SET valor_total = (
    SELECT COALESCE(SUM(quantidade * custo_unitario), 0)
    FROM estoque_lote_itens
    WHERE lote_id = v_lote_id
  )
  WHERE id = v_lote_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lote_atualiza_total ON estoque_lote_itens;
CREATE TRIGGER trg_lote_atualiza_total
  AFTER INSERT OR UPDATE OR DELETE ON estoque_lote_itens
  FOR EACH ROW EXECUTE FUNCTION _lote_atualiza_total();

-- ------------------------------------------------------------
-- 11. Função fn_recalcular_abc
--     Agrupa saídas dos últimos 90 dias por produto (SUM quantidade),
--     classifica top 20% → A, próximos 30% → B, restantes → C.
--     Chamada via supabase.rpc('fn_recalcular_abc').
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_recalcular_abc()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_total   INT;
  v_a_corte INT;
  v_b_corte INT;
BEGIN
  -- Zera classificação atual em produtos ativos
  UPDATE estoque_produtos SET classificacao_abc = NULL WHERE ativo = true;

  SELECT COUNT(DISTINCT produto_id) INTO v_total
  FROM estoque_movimentacoes
  WHERE tipo IN ('saida', 'perda')
    AND created_at >= NOW() - INTERVAL '90 days';

  IF v_total = 0 THEN RETURN; END IF;

  v_a_corte := GREATEST(1, CEIL(v_total * 0.20)::INT);
  v_b_corte := v_a_corte + GREATEST(1, CEIL(v_total * 0.30)::INT);

  WITH ranked AS (
    SELECT
      produto_id,
      ROW_NUMBER() OVER (ORDER BY SUM(quantidade) DESC) AS rn
    FROM estoque_movimentacoes
    WHERE tipo IN ('saida', 'perda')
      AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY produto_id
  )
  UPDATE estoque_produtos ep
  SET classificacao_abc = CASE
    WHEN r.rn <= v_a_corte THEN 'A'
    WHEN r.rn <= v_b_corte THEN 'B'
    ELSE                        'C'
  END
  FROM ranked r
  WHERE ep.id = r.produto_id;
END;
$$;

-- ------------------------------------------------------------
-- 12. Seed: fornecedor + 5 produtos de exemplo
-- ------------------------------------------------------------

INSERT INTO estoque_fornecedores (nome, telefone, contato, prazo_entrega_dias)
VALUES ('Fornecedor Exemplo', '(11) 99999-0001', 'João Silva', 7)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  cat_tecido    UUID;
  cat_ferragem  UUID;
  cat_acessorio UUID;
BEGIN
  SELECT id INTO cat_tecido    FROM estoque_categorias WHERE nome = 'Tecidos Rolo'     LIMIT 1;
  SELECT id INTO cat_ferragem  FROM estoque_categorias WHERE nome = 'Trilhos e Perfis'  LIMIT 1;
  SELECT id INTO cat_acessorio FROM estoque_categorias WHERE nome = 'Acabamentos'       LIMIT 1;

  IF cat_tecido IS NOT NULL THEN
    INSERT INTO estoque_produtos (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario, fornecedor) VALUES
      ('Tecido Blackout Branco',   'TEC-BLK-BR', cat_tecido, 'm2', 150, 20, 45.00, 'Fornecedor Exemplo'),
      ('Tecido Screen 5% Cinza',   'TEC-SCR-CZ', cat_tecido, 'm2',  80, 15, 52.00, 'Fornecedor Exemplo'),
      ('Tecido Translúcido Bege',  'TEC-TRN-BG', cat_tecido, 'm2',  60, 10, 38.00, 'Fornecedor Exemplo')
    ON CONFLICT (codigo) DO NOTHING;
  END IF;

  IF cat_ferragem IS NOT NULL THEN
    INSERT INTO estoque_produtos (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario) VALUES
      ('Trilho Alumínio 3m', 'TRI-ALU-3M', cat_ferragem, 'un', 25, 5, 28.00)
    ON CONFLICT (codigo) DO NOTHING;
  END IF;

  IF cat_acessorio IS NOT NULL THEN
    INSERT INTO estoque_produtos (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario) VALUES
      ('Bandô Alumínio 3m', 'BAN-ALU-3M', cat_acessorio, 'un', 18, 4, 15.00)
    ON CONFLICT (codigo) DO NOTHING;
  END IF;
END $$;
