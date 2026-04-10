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
