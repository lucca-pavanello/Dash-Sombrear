-- =============================================================
-- Migration 0001 — Estoque Fase 1: ENUMs + estoque_vendas + estoque_venda_itens
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES / O QUE FOI PULADO:
--
-- As tabelas abaixo já existem no banco (criadas em setup_estoque.sql)
-- com schemas ligeiramente diferentes dos especificados nesta migration.
-- Foram mantidas sem alteração para não quebrar o front-end já funcional:
--
--   estoque_fornecedores  — existe (colunas: cnpj, telefone, email, prazo_entrega_dias)
--                           prompt pedia: lead_time_medio_dias, sem cnpj/telefone/email
--
--   estoque_produtos      — existe (colunas: codigo, categoria_id, quantidade_atual,
--                           quantidade_minima, custo_unitario, classificacao_abc TEXT)
--                           prompt pedia: sku, tipo ENUM, estoque_atual, classe_abc ENUM
--
--   estoque_lotes         — existe como cabeçalho de compra (fornecedor_id, nf_numero,
--                           valor_total). Prompt pedia lote PEPS por produto com
--                           quantidade_inicial/restante. Refactor planejado na Fase 3.
--
--   estoque_movimentacoes — existe (colunas: responsavel TEXT, quantidade_anterior,
--                           orcamento_id, motivo, nota_fiscal)
--                           prompt pedia: usuario_id UUID, sem quantidade_anterior
--
-- Os 4 ENUMs são criados standalone. As tabelas existentes continuam usando
-- CHECK constraints; os ENUMs ficam disponíveis para uso nas Fases 2-4.
--
-- =============================================================

-- -------------------------------------------------------------
-- 1. ENUMs
-- -------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE estoque_tipo_produto AS ENUM ('tecido', 'ferragem', 'acessorio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estoque_unidade AS ENUM ('metro', 'metro_quadrado', 'peca', 'kit', 'par');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estoque_classe_abc AS ENUM ('A', 'B', 'C', 'sem_dados');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estoque_tipo_movimento AS ENUM ('entrada', 'saida', 'ajuste_positivo', 'ajuste_negativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------
-- 2. estoque_vendas
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_vendas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE        NOT NULL DEFAULT CURRENT_DATE,
  cliente     TEXT,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendedor_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_estoque_vendas_data ON estoque_vendas(data DESC);

-- RLS
ALTER TABLE estoque_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON estoque_vendas;
CREATE POLICY "auth_all"
  ON estoque_vendas
  FOR ALL
  USING (auth.role() = 'authenticated');

-- -------------------------------------------------------------
-- 3. estoque_venda_itens
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estoque_venda_itens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id       UUID        NOT NULL REFERENCES estoque_vendas(id) ON DELETE CASCADE,
  produto_id     UUID        NOT NULL REFERENCES estoque_produtos(id),
  quantidade     NUMERIC(12,2) NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(12,2) NOT NULL CHECK (preco_unitario >= 0),
  desconto       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  subtotal       NUMERIC(12,2) GENERATED ALWAYS AS
                   ((quantidade * preco_unitario) - desconto) STORED
);

CREATE INDEX IF NOT EXISTS idx_estoque_venda_itens_venda   ON estoque_venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_estoque_venda_itens_produto ON estoque_venda_itens(produto_id);

-- RLS
ALTER TABLE estoque_venda_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON estoque_venda_itens;
CREATE POLICY "auth_all"
  ON estoque_venda_itens
  FOR ALL
  USING (auth.role() = 'authenticated');
