-- 0027 — Funil IA x equipe na aba Agente IA.
--
-- DEPENDE DA 0023 (mensagens_sombrear) e da 0024 (resumir-conversas).
--
-- POR QUE (Lucca, 01/10/2026): o funil do Agente IA misturava IA e equipe numa barra só.
-- Agora cada lado tem as suas fases (atendeu, mandou orçamento, medição agendada) e os
-- convertidos somam os dois. Faltavam dois dados:
--  - quem respondeu cada lead: sai das mensagens gravadas (0023), agregadas por lead;
--  - a medição que a EQUIPE marca no WhatsApp: não ficava em lugar nenhum. O resumo das
--    conversas com humano (resumir-conversas) passa a ler e gravar em `medicao_equipe`.
--    `data_medicao_instalacao` continua sendo a medição que a IA coletou.

create or replace view public.atendimento_por_lead
with (security_invoker = true) as
  select lead_id,
         bool_or(autor = 'ia')     as ia_respondeu,
         bool_or(autor = 'equipe') as equipe_respondeu
  from public.mensagens_sombrear
  where lead_id is not null and not privada and not excluida
  group by lead_id;

grant select on public.atendimento_por_lead to authenticated;

-- quando a equipe combinou a visita de medição (texto livre, como data_medicao_instalacao).
-- null = a equipe não marcou. O resumo só preenche, nunca apaga.
alter table public.crm_sombrear_ia add column if not exists medicao_equipe text;
