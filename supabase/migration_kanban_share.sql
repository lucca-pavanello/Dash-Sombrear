-- ============================================================
-- Migration: Kanban + Share
-- Execute no Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- 1. Coluna kanban_status
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS kanban_status TEXT NOT NULL DEFAULT 'em_aberto'
  CHECK (kanban_status IN ('em_aberto', 'negociando', 'fechado', 'perdido'));

-- 2. Backfill: orçamentos já fechados → coluna 'fechado'
UPDATE orcamentos SET kanban_status = 'fechado' WHERE fechado = true;

-- 3. Coluna share_enabled
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;

-- 4. Index de performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_kanban_status ON orcamentos(kanban_status);

-- 5. RLS: anon só lê orçamentos com share_enabled = true
CREATE POLICY "orcamentos_public_share_select"
  ON orcamentos FOR SELECT TO anon
  USING (share_enabled = true);
