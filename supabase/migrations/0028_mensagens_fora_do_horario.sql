-- 0028 — Mensagens de clientes que chegaram fora do horário comercial.
--
-- DEPENDE DA 0025 (mensagens_sombrear_respostas).
--
-- POR QUE (Lucca, 01/10/2026): o card "Msgs fora do horário" contava leads cuja ÚLTIMA
-- mensagem foi fora do comercial, e por isso passava do "Pessoas fora do horário" sem
-- ninguém entender. Agora conta mensagens de verdade e diz quem respondeu e em quanto
-- tempo: é aqui que aparece o valor de a Amanda responder à noite e no fim de semana.
--
-- Horário comercial igual ao do dash (src/lib/constants.ts: HORA_INICIO 8, HORA_FIM 18,
-- de segunda a sexta), no fuso de Rio Preto. Mudou lá, mudar aqui.

create or replace view public.mensagens_fora_do_horario
with (security_invoker = true) as
  select mensagem_id, lead_id, recebida_em, respondida_por, minutos_ate_resposta
  from public.mensagens_sombrear_respostas
  where extract(isodow from recebida_em at time zone 'America/Sao_Paulo') >= 6
     or extract(hour from recebida_em at time zone 'America/Sao_Paulo') < 8
     or extract(hour from recebida_em at time zone 'America/Sao_Paulo') >= 18;

grant select on public.mensagens_fora_do_horario to authenticated;
