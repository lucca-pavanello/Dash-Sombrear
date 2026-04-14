-- =============================================================
-- Seed — Estoque Fase 1: Fornecedores + Produtos realistas
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================
--
-- ADAPTAÇÕES:
--   lead_time_medio_dias  → prazo_entrega_dias (coluna real)
--   tipo (texto)          → categoria_id via subquery por nome
--   preco_venda           → coluna adicionada abaixo (não existia)
--   fornecedor_id         → fornecedor TEXT (sem FK na Fase 1)
--   sku                   → codigo (coluna real)
--   quantidade_atual      → iniciada em 0 (estoque será feito pela interface)
--
-- Os 5 produtos do seed original (TEC-BLK-BR..BAN-ALU-3M) são mantidos.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Adicionar coluna preco_venda (referência para vendas)
-- -------------------------------------------------------------

ALTER TABLE estoque_produtos
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(12,2);

-- -------------------------------------------------------------
-- 2. Fornecedores
-- -------------------------------------------------------------

INSERT INTO estoque_fornecedores (nome, prazo_entrega_dias, ativo)
VALUES
  ('Fornecedor Tecidos SP',     15, true),
  ('Distribuidora de Ferragens', 7, true)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------
-- 3. Produtos (10 itens, estoque_atual = 0)
-- -------------------------------------------------------------

DO $$
DECLARE
  cat_tecido    UUID;
  cat_trilhos   UUID;
  cat_comandos  UUID;
  cat_suportes  UUID;
  cat_acabam    UUID;
BEGIN
  SELECT id INTO cat_tecido   FROM estoque_categorias WHERE nome = 'Tecidos Rolo'        LIMIT 1;
  SELECT id INTO cat_trilhos  FROM estoque_categorias WHERE nome = 'Trilhos e Perfis'    LIMIT 1;
  SELECT id INTO cat_comandos FROM estoque_categorias WHERE nome = 'Comandos e Correntes' LIMIT 1;
  SELECT id INTO cat_suportes FROM estoque_categorias WHERE nome = 'Suportes e Fixação'  LIMIT 1;
  SELECT id INTO cat_acabam   FROM estoque_categorias WHERE nome = 'Acabamentos'         LIMIT 1;

  -- Tecidos (5 produtos, unidade = m)
  INSERT INTO estoque_produtos
    (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario, preco_venda, fornecedor)
  VALUES
    ('Tecido Blackout Branco 2.80m', 'TCD-001', cat_tecido, 'm', 0, 10, 55.00, 140.00, 'Fornecedor Tecidos SP'),
    ('Tecido Blackout Bege 2.80m',   'TCD-002', cat_tecido, 'm', 0, 10, 55.00, 140.00, 'Fornecedor Tecidos SP'),
    ('Tecido Translúcido Branco',    'TCD-003', cat_tecido, 'm', 0,  8, 38.00,  90.00, 'Fornecedor Tecidos SP'),
    ('Tecido Linho Cru 2.80m',       'TCD-004', cat_tecido, 'm', 0,  5, 75.00, 185.00, 'Fornecedor Tecidos SP'),
    ('Tecido Voil Branco 2.80m',     'TCD-005', cat_tecido, 'm', 0,  5, 35.00,  85.00, 'Fornecedor Tecidos SP')
  ON CONFLICT (codigo) DO NOTHING;

  -- Ferragens trilhos (2 produtos, unidade = un)
  INSERT INTO estoque_produtos
    (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario, preco_venda, fornecedor)
  VALUES
    ('Trilho Rolô 1.20m Branco',       'FER-001', cat_trilhos, 'un', 0, 5,  45.00, 110.00, 'Distribuidora de Ferragens'),
    ('Trilho Romana 1.50m Alumínio',   'FER-002', cat_trilhos, 'un', 0, 3, 120.00, 280.00, 'Distribuidora de Ferragens')
  ON CONFLICT (codigo) DO NOTHING;

  -- Ferragem comando (1 produto, unidade = un)
  INSERT INTO estoque_produtos
    (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario, preco_venda, fornecedor)
  VALUES
    ('Comando Duplo Metal Cromado', 'FER-003', cat_comandos, 'un', 0, 10, 30.00, 80.00, 'Distribuidora de Ferragens')
  ON CONFLICT (codigo) DO NOTHING;

  -- Acessórios (2 produtos, unidade = un)
  INSERT INTO estoque_produtos
    (nome, codigo, categoria_id, unidade, quantidade_atual, quantidade_minima, custo_unitario, preco_venda, fornecedor)
  VALUES
    ('Kit Fixação Teto',       'ACS-001', cat_suportes, 'un', 0, 10, 12.00, 30.00, 'Distribuidora de Ferragens'),
    ('Ponteira Decorativa Par', 'ACS-002', cat_acabam,   'un', 0, 10,  8.00, 25.00, 'Distribuidora de Ferragens')
  ON CONFLICT (codigo) DO NOTHING;

END $$;
