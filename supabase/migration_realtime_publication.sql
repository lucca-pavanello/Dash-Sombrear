-- Habilita realtime (postgres_changes) nas tabelas que o dash escuta.
-- Contexto: em 2026-07-13 a publication supabase_realtime existia mas estava VAZIA —
-- o canal 'orcamentos-realtime' do useOrcamentos assinava com sucesso porém nunca
-- recebia eventos; quem mantinha o dash atualizado era o polling de 30s.
--
-- REPLICA IDENTITY FULL em orcamentos: a subscription filtra por user_id, e sem
-- replica identity full os eventos DELETE não carregam as colunas antigas e são
-- descartados pelo filtro.

alter table public.orcamentos replica identity full;

alter publication supabase_realtime add table public.orcamentos;
alter publication supabase_realtime add table public.crm_sombrear_ia;
alter publication supabase_realtime add table public.orcamentos_sombrear_ia;

-- Verificação:
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime';
