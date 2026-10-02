-- 0030 — Revisão diária da Amanda: o que dá pra melhorar nas conversas do dia.
--
-- DEPENDE DA 0023 (mensagens_sombrear) e dos segredos do Vault (automacao_segredo e
-- funcoes_base_url, os mesmos que a 0024 usa). A guarda abaixo aborta se faltarem.
--
-- ANTES DE RODAR: publicar a Edge Function `revisao-diaria`.
--
-- POR QUE (Lucca, 02/10/2026): é o ritual que ele já faz todo dia no Garimpo e queria
-- aqui. Lá a revisão é a parte mais usada do painel — mais que a análise de período,
-- porque cabe numa leitura por noite e vira pedido de ajuste no dia seguinte.
--
-- O QUE A REVISÃO OLHA: só a Amanda, por decisão dele. Na Sombrear quem fala é gente
-- (em 01/10: 181 mensagens de cliente, 218 da equipe, 15 da IA), então é esperado que
-- alguns dias saiam curtos — e a revisão diz isso em vez de inventar conteúdo.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_segredo')
     or not exists (select 1 from vault.decrypted_secrets where name = 'funcoes_base_url') then
    raise exception 'Faltam os segredos do Vault (automacao_segredo, funcoes_base_url).';
  end if;
  if to_regclass('public.mensagens_sombrear') is null then
    raise exception 'Rode a 0023 primeiro (mensagens_sombrear).';
  end if;
end $$;


-- ── 1. Onde a revisão fica ───────────────────────────────────────────────
create table if not exists public.revisoes_ia (
  id           uuid primary key default gen_random_uuid(),
  dia          date not null,
  origem       text not null default 'diaria' check (origem in ('diaria', 'manual')),
  -- null = foi o cron; com valor = o admin pediu pela tela
  criado_por   uuid references auth.users(id) on delete set null,
  status       text not null default 'rodando' check (status in ('rodando', 'pronta', 'erro')),
  erro         text,
  -- { dia, conversas, amostra, sem_resposta, analise: { resumo, melhorias[] }, gerado_em }
  -- a forma mora em src/lib/revisao/dia.ts; aqui é jsonb porque quem lê é a tela
  resultado    jsonb,
  criado_em    timestamptz not null default now(),
  concluido_em timestamptz
);

-- a tela abre sempre no dia mais recente, e a navegação ‹ dias › anda por esta ordem
create index if not exists revisoes_ia_dia_idx on public.revisoes_ia (dia desc, criado_em desc);

alter table public.revisoes_ia enable row level security;

-- leitura de admin: é leitura de conversa de cliente, mesmo que resumida
drop policy if exists revisoes_ia_admin_le on public.revisoes_ia;
create policy revisoes_ia_admin_le on public.revisoes_ia
  for select to authenticated using (public.eh_admin());

-- quem escreve é a função (service_role): ninguém cria revisão direto pela tabela,
-- senão apareceria revisão sem conversa nenhuma por trás
revoke insert, update, delete on public.revisoes_ia from authenticated, anon;
grant select on public.revisoes_ia to authenticated;


-- ── 2. Disparo e cron (todo dia às 21h de Rio Preto) ─────────────────────
create or replace function public.disparar_revisao_diaria()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/revisao-diaria',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end
$function$;

-- pg_cron é UTC: '0 0 * * *' = 21h00 em Rio Preto (UTC-3 o ano todo).
-- A função responde na hora e lê as conversas em segundo plano, por isso o timeout
-- curto acima não corta a revisão no meio.
select cron.unschedule(jobid) from cron.job where jobname = 'revisao-diaria';
select cron.schedule('revisao-diaria', '0 0 * * *',
  $cron$ select public.disparar_revisao_diaria() $cron$);


-- ── Conferência ──────────────────────────────────────────────────────────
select jobid, jobname, schedule, active from cron.job where jobname = 'revisao-diaria';
select count(*) as revisoes from public.revisoes_ia;

-- Prova de verdade: abrir Agente IA > Revisão diária, pedir a revisão de um dia e
-- conferir que a linha sai de 'rodando' e o texto cita fala que está na conversa.


-- ── Voltar atrás ─────────────────────────────────────────────────────────
-- select cron.unschedule('revisao-diaria');
-- drop function if exists public.disparar_revisao_diaria();
-- drop table if exists public.revisoes_ia;
