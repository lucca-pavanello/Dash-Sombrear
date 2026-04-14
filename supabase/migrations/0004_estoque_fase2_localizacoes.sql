-- =============================================================
-- Migration 0004 — Estoque Fase 2: Localizações físicas + view sugestão movimentação
-- Projeto: nlswyjpjzibuvdsaooyg
-- =============================================================

DO $$ BEGIN
  CREATE TYPE estoque_nivel_acesso AS ENUM ('balcao', 'acessivel', 'medio', 'fundo', 'deposito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS estoque_localizacoes (
  id            UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT                    UNIQUE NOT NULL,
  setor         TEXT                    NOT NULL,
  prateleira    TEXT,
  posicao       TEXT,
  nivel_acesso  estoque_nivel_acesso    NOT NULL,
  descricao     TEXT,
  ativo         BOOLEAN                 DEFAULT true,
  created_at    TIMESTAMPTZ             DEFAULT now(),
  updated_at    TIMESTAMPTZ             DEFAULT now()
);

ALTER TABLE estoque_produtos
  ADD COLUMN IF NOT EXISTS localizacao_id UUID REFERENCES estoque_localizacoes(id);

CREATE INDEX IF NOT EXISTS idx_estoque_produtos_localizacao
  ON estoque_produtos(localizacao_id);

ALTER TABLE estoque_localizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON estoque_localizacoes;
CREATE POLICY "auth_all" ON estoque_localizacoes
  FOR ALL USING (auth.role() = 'authenticated');

-- View: sugestão de remanejamento baseada em ABC × nível de acesso
-- Regra: A → balcao/acessivel | B → medio | C → fundo/deposito
-- Retorna apenas produtos cuja localização atual NÃO combina com a classe ABC
CREATE OR REPLACE VIEW estoque_vw_sugestao_movimentacao AS
SELECT
  p.id                                        AS produto_id,
  p.codigo                                    AS sku,
  p.nome,
  p.classificacao_abc                         AS classe_abc,
  l.id                                        AS localizacao_id,
  l.codigo                                    AS localizacao_codigo,
  l.nivel_acesso                              AS nivel_atual,
  CASE p.classificacao_abc
    WHEN 'A' THEN 'balcao ou acessivel'
    WHEN 'B' THEN 'medio'
    WHEN 'C' THEN 'fundo ou deposito'
  END                                         AS nivel_sugerido,
  CASE p.classificacao_abc
    WHEN 'A' THEN 'Mover para balcão ou área acessível (produto de alto giro)'
    WHEN 'B' THEN 'Mover para prateleira média (giro intermediário)'
    WHEN 'C' THEN 'Mover para fundo ou depósito (baixo giro)'
  END                                         AS acao_sugerida
FROM estoque_produtos p
JOIN estoque_localizacoes l ON l.id = p.localizacao_id
WHERE p.ativo = true
  AND p.classificacao_abc IS NOT NULL
  AND p.classificacao_abc != 'sem_dados'
  AND NOT (
    (p.classificacao_abc = 'A' AND l.nivel_acesso IN ('balcao', 'acessivel')) OR
    (p.classificacao_abc = 'B' AND l.nivel_acesso = 'medio')                  OR
    (p.classificacao_abc = 'C' AND l.nivel_acesso IN ('fundo', 'deposito'))
  );
