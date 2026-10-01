-- 0024 — Resumo das conversas tocadas pela equipe sai do n8n.
--
-- DEPENDE DA 0020 (segredos do Vault) e da 0023 (mensagens_sombrear).
--
-- ANTES DE RODAR: Edge Function `resumir-conversas` publicada (usa META_API_KEY).
--
-- A REGRA (Lucca, 01/10): conversa com etiqueta `humano` no Chatwoot, parada há 3 horas
-- (última mensagem da equipe ou do cliente), ganha um resumo de como está a conversa no
-- `resumo_conversa` do lead. Só resume de novo quando a conversa anda.
--
-- Antes isso era um ramo do workflow n8n "Amanda | Desfecho do atendimento": lia só as
-- últimas 20 mensagens no Chatwoot, de 3 em 3 horas, e dividia o `resumo_conversa` com o
-- log que o "CRM segue vivo" colava no fim. Agora lê a conversa inteira do banco.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_segredo')
     or not exists (select 1 from vault.decrypted_secrets where name = 'funcoes_base_url') then
    raise exception 'Rode a 0020 primeiro (segredos do Vault).';
  end if;
end $$;


-- ── 1. Quem precisa de resumo ────────────────────────────────────────────
-- `todas` ignora o "já resumido depois da última mensagem" (usado na primeira carga).
create or replace function public.conversas_para_resumir(horas integer default 3, todas boolean default false)
returns table (lead_id uuid, conversa_id bigint, ultima_msg timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id, m.conversa_id, max(m.enviada_em)
  from crm_sombrear_ia l
  join mensagens_sombrear m on m.lead_id = l.id
  where (',' || replace(lower(coalesce(l.chatwoot_labels, '')), ' ', '') || ',') like '%,humano,%'
    and not m.privada
    and m.autor in ('cliente', 'equipe')
  group by l.id, m.conversa_id, l.resumo_em
  having max(m.enviada_em) <= now() - make_interval(hours => horas)
     and (todas or l.resumo_em is null or max(m.enviada_em) > l.resumo_em)
  order by max(m.enviada_em) desc
$function$;

revoke all on function public.conversas_para_resumir(integer, boolean) from public, anon, authenticated;
grant execute on function public.conversas_para_resumir(integer, boolean) to service_role;


-- ── 2. Disparo e cron (a cada 15 minutos) ────────────────────────────────
create or replace function public.disparar_resumir_conversas()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/resumir-conversas',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );
end
$function$;

select cron.unschedule(jobid) from cron.job where jobname = 'resumir-conversas';
select cron.schedule('resumir-conversas', '*/15 * * * *',
  $cron$ select public.disparar_resumir_conversas() $cron$);
