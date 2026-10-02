-- 0029 — Insights separados: o atendimento da IA e o atendimento da equipe.
--
-- DEPENDE DA 0020 (segredos do Vault), 0023 (mensagens_sombrear), 0025 (quem respondeu)
-- e 0027 (atendimento_por_lead).
--
-- ANTES DE RODAR: Edge Function `classificar-fases` publicada (usa META_API_KEY).
--
-- POR QUE (Lucca, 02/10/2026): os Insights da Amanda liam a conversa inteira, então o que
-- a equipe fez e o que a IA fez saíam misturados. O Matheus (tráfego e consultoria de
-- vendas da Sombrear) precisa ver o atendimento da equipe à parte pra saber o que ela pode
-- melhorar. A conversa é partida na PASSAGEM, a primeira mensagem da equipe: o que vem
-- antes é da IA, o que vem depois é da equipe. Cada trecho ganha a sua leitura.
--
-- A classificação da conversa inteira (classificacao_*, objecao_tags) continua igual: ela
-- alimenta o veredito por conversa e a aba Análises.


-- ── 1. A leitura de cada trecho ─────────────────────────────────────────
-- null = o trecho não existe (a IA não falou antes da passagem, ou a equipe nunca entrou)
-- ou ainda não foi lido. Array vazio = lido, sem nada a marcar.
alter table public.crm_sombrear_ia
  add column if not exists ia_objecao_tags            text[],
  add column if not exists ia_objecao_outro           text,
  add column if not exists ia_motivo                  text,
  add column if not exists ia_sensibilidade_preco     text,
  -- venda nova, pós-venda (instalação, conserto, prazo) ou não é cliente (fornecedor)
  add column if not exists equipe_assunto             text
    check (equipe_assunto in ('venda', 'pos_venda', 'nao_cliente')),
  add column if not exists equipe_objecao_tags        text[],
  add column if not exists equipe_objecao_outro       text,
  -- o que a equipe deixou passar (src/lib/insights/taxonomia.ts, FALHAS)
  add column if not exists equipe_falhas              text[],
  add column if not exists equipe_falha_outro         text,
  add column if not exists equipe_motivo              text,
  add column if not exists equipe_sensibilidade_preco text,
  -- quando os dois trechos foram lidos; a conversa volta pra fila quando anda depois disso
  add column if not exists fases_em                   timestamptz;


-- ── 2. Números da equipe por lead ───────────────────────────────────────
-- Acrescenta colunas no fim da view da 0027 (o funil continua lendo as duas primeiras).
-- passagem_em: a primeira mensagem da equipe. Áudio conta à parte porque preço e
-- condição mandados em áudio não ficam escritos para o cliente reler.
create or replace view public.atendimento_por_lead
with (security_invoker = true) as
  select lead_id,
         bool_or(autor = 'ia')     as ia_respondeu,
         bool_or(autor = 'equipe') as equipe_respondeu,
         min(enviada_em) filter (where autor = 'equipe') as passagem_em,
         count(*) filter (where autor = 'equipe')        as msgs_equipe,
         count(*) filter (where autor = 'equipe' and (
           anexos @> '[{"tipo":"audio"}]'::jsonb or conteudo ilike '%audiomessage%'
         ))                                              as audios_equipe
  from public.mensagens_sombrear
  where lead_id is not null and not privada and not excluida
  group by lead_id;

grant select on public.atendimento_por_lead to authenticated;

-- Tempo de resposta da equipe, só com mensagem do cliente que chegou no horário comercial
-- (mesma régua da 0028: seg a sex, 8h às 18h, fuso de Rio Preto). Fora do horário a
-- espera da noite entraria na conta e o número não diria nada sobre a equipe.
create or replace view public.respostas_equipe_por_lead
with (security_invoker = true) as
  select lead_id,
         count(*)                                                        as respostas,
         percentile_cont(0.5) within group (order by minutos_ate_resposta) as mediana_min,
         count(*) filter (where minutos_ate_resposta > 60)               as esperas_longas
  from public.mensagens_sombrear_respostas
  where respondida_por = 'equipe'
    and lead_id is not null
    and extract(isodow from recebida_em at time zone 'America/Sao_Paulo') < 6
    and extract(hour from recebida_em at time zone 'America/Sao_Paulo') between 8 and 17
  group by lead_id;

grant select on public.respostas_equipe_por_lead to authenticated;


-- ── 3. Quem precisa de leitura ──────────────────────────────────────────
-- Conversa parada há 1 hora que nunca foi lida ou andou depois da última leitura.
-- `todas` relê tudo (primeira carga).
create or replace function public.conversas_para_fases(todas boolean default false)
returns table (lead_id uuid, ultima_msg timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id, max(m.enviada_em)
  from crm_sombrear_ia l
  join mensagens_sombrear m on m.lead_id = l.id
  where not m.privada and not m.excluida
  group by l.id, l.fases_em
  having max(m.enviada_em) <= now() - interval '1 hour'
     and (todas or l.fases_em is null or max(m.enviada_em) > l.fases_em)
  order by max(m.enviada_em) desc
$function$;

revoke all on function public.conversas_para_fases(boolean) from public, anon, authenticated;
grant execute on function public.conversas_para_fases(boolean) to service_role;


-- ── 4. Disparo e cron (a cada 20 minutos) ───────────────────────────────
create or replace function public.disparar_classificar_fases()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/classificar-fases',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );
end
$function$;

revoke all on function public.disparar_classificar_fases() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'classificar-fases';
select cron.schedule('classificar-fases', '*/20 * * * *',
  $cron$ select public.disparar_classificar_fases() $cron$);
