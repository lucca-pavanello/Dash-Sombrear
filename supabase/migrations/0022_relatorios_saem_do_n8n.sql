-- 0022 — O relatório por período deixa de passar pelo n8n.
--
-- DEPENDE DA 0020 (segredos do Vault). A guarda abaixo aborta se não rodou.
--
-- ANTES DE RODAR:
--   1. Edge Function `relatorios-periodo` publicada.
--   2. Function Secret `META_API_KEY` configurado (é a chave do Muse; veio de
--      ~/.secrets/sombrear-meta.env, campo META_API_KEY_DASH).
--
-- O QUE MUDA, ALÉM DE SAIR DO n8n
-- O workflow rodava a cada 2 MINUTOS, das 6h às 23h, com
-- `saveDataSuccessExecution: none`. São ~510 execuções por dia, invisíveis no
-- histórico por configuração, e quase todas só para descobrir que não havia
-- nada a fazer. Aqui vira:
--
--   • um cron DIÁRIO, que pega semana/mês/ano assim que fecham;
--   • um trigger em `relatorios_pedidos`, que atende o pedido do usuário NA
--     HORA — antes ele esperava até 2 minutos.
--
-- Sobre o horário: a decisão de "qual semana já fechou" é feita com datas em
-- UTC, tanto no n8n quanto no port. Rodando 04:10 UTC, a segunda-feira já
-- virou em UTC e a semana anterior sai completa.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_segredo')
     or not exists (select 1 from vault.decrypted_secrets where name = 'funcoes_base_url') then
    raise exception 'Rode a 0020 primeiro (segredos do Vault).';
  end if;
end $$;


-- ── 1. Função de disparo, reaproveitada pelo cron e pelo trigger ─────────
create or replace function public.disparar_relatorios_periodo()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/relatorios-periodo',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 55000
  );
end
$function$;


-- ── 2. Cron diário ───────────────────────────────────────────────────────
-- pg_cron é UTC: '10 4 * * *' = 01h10 no horário de Brasília.
select cron.unschedule(jobid) from cron.job where jobname = 'relatorios-periodo';
select cron.schedule('relatorios-periodo', '10 4 * * *',
  $cron$ select public.disparar_relatorios_periodo() $cron$);


-- ── 3. Pedido do usuário sai na hora ─────────────────────────────────────
create or replace function public.notify_relatorio_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'pendente' then
    perform public.disparar_relatorios_periodo();
  end if;
  return new;
exception when others then
  -- o cron diário cobre se o disparo imediato falhar; o pedido fica pendente e
  -- é atendido na próxima rodada, então nunca se perde
  return new;
end
$function$;

drop trigger if exists notify_relatorio_pedido on public.relatorios_pedidos;
create trigger notify_relatorio_pedido
  after insert on public.relatorios_pedidos
  for each row execute function public.notify_relatorio_pedido();


-- ── Conferência ──────────────────────────────────────────────────────────
select jobid, jobname, schedule, active from cron.job where jobname = 'relatorios-periodo';
select tgname from pg_trigger
 where tgrelid = 'public.relatorios_pedidos'::regclass and not tgisinternal;

-- Prova de verdade: peça um relatório pela tela de Relatórios e confira que a
-- linha aparece em `relatorios_ia` em segundos, e que o pedido virou 'pronto'.


-- ── Voltar atrás ─────────────────────────────────────────────────────────
-- select cron.unschedule('relatorios-periodo');
-- drop trigger if exists notify_relatorio_pedido on public.relatorios_pedidos;
-- drop function if exists public.notify_relatorio_pedido();
-- drop function if exists public.disparar_relatorios_periodo();
-- e reativar o workflow JpZHo2U2y3eY4cjj no n8n.
