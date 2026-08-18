-- 2026-08-18 — pedido da loja: o "mais barato" separa Tela Solar 1% de 3%
-- (produtos diferentes; antes 'tela_solar' pegava sempre o 3%, mais barato).
-- JÁ APLICADO em produção via Management API — registro.
alter table precos_tecidos drop constraint precos_tecidos_tipo_check;
alter table precos_tecidos add constraint precos_tecidos_tipo_check
  check (tipo = any (array['blackout','tela_solar','tela_solar_1','tela_solar_3','decorativo','outro']));
update precos_tecidos set tipo='tela_solar_1' where tipo='tela_solar' and nome ilike '%1%%';
update precos_tecidos set tipo='tela_solar_3' where tipo='tela_solar' and nome ilike '%3%%';
-- 'tela_solar' genérico segue aceito pelo resolver do Supervisor (= 1% ou 3%, o mais barato) — Stella e pedidos antigos.
