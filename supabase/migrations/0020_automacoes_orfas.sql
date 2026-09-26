-- 0020 — Traz para o repo as automações que só existiam no banco, e tira o
--        segredo compartilhado de texto puro.
--
-- CONTEXTO
-- Duas automações rodam em produção há semanas e não têm arquivo nenhum neste
-- repo — existem só como comentário no cabeçalho das Edge Functions:
--   • trigger `trg_push_aceite` em `orcamentos` → função `push-aceite`
--   • job pg_cron `backup-semanal` (segundas 06:00 UTC) → função `backup-semanal`
-- Se o projeto Supabase precisasse ser recriado, as duas sumiriam em silêncio.
--
-- Pior: as duas autenticam com um segredo compartilhado escrito EM TEXTO PURO,
-- uma dentro do corpo do `net.http_post` da função de trigger, outra dentro do
-- `command` do `cron.job`. Qualquer um com leitura no banco lê o segredo.
--
-- Esta migration versiona as duas e move o segredo para o `supabase_vault`,
-- que já está instalado (0.3.1). O padrão é o do Pavanello/mesa.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ESTADO EM 26/09/2026 — LEIA ANTES DE RODAR
--
-- Os dois segredos do Vault JÁ EXISTEM. Eu os criei:
--
--   automacao_segredo  = o MESMO valor que as functions já usam hoje
--   funcoes_base_url   = https://nlswyjpjzibuvdsaooyg.supabase.co/functions/v1
--
-- Ou seja: esta migration pode rodar direto, e não muda comportamento nenhum.
-- O que ela faz é tirar o segredo de TEXTO PURO de dentro do `cron.job.command`
-- e do corpo de `notify_push_aceite`, passando a lê-lo do Vault.
--
-- ⚠️ A ROTAÇÃO CONTINUA PENDENTE, E É SUA
-- O valor atual está exposto no banco desde sempre — esconder não desqueima.
-- Tentei rotacionar e fui barrado: escrever em cofre de segredos não é algo que
-- eu possa fazer aqui. São três passos, nesta ordem, DEPOIS desta migration:
--
--   1. Gere um valor novo (ex.: openssl rand -base64 36 | tr -d '/+=' | head -c 48)
--   2. npx supabase secrets set PUSH_TRIGGER_SECRET=<novo> --project-ref nlswyjpjzibuvdsaooyg
--   3. No SQL Editor, alinhe o Vault na sequência — a janela entre 2 e 3 é a
--      única em que push de aceite e backup falhariam com 401:
--        select vault.update_secret(
--          (select id from vault.secrets where name = 'automacao_segredo'),
--          '<novo>');
--
-- Conferir depois: aceite um orçamento de teste e veja se o push chega.
-- ─────────────────────────────────────────────────────────────────────────

-- guarda: se o Vault não tiver os dois segredos, para aqui em vez de deixar as
-- automações apontando para lugar nenhum
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_segredo')
     or not exists (select 1 from vault.decrypted_secrets where name = 'funcoes_base_url') then
    raise exception 'Faltam os segredos do Vault. Veja o cabeçalho deste arquivo (passo 3).';
  end if;
end $$;


-- ── 1. Push quando o cliente aceita o orçamento ──────────────────────────
-- Igual à versão que está em produção, só que lendo URL e segredo do Vault.
create or replace function public.notify_push_aceite()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.aceito_em is not null and old.aceito_em is null then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets
              where name = 'funcoes_base_url') || '/push-aceite',
      body := jsonb_build_object(
        'segredo', (select decrypted_secret from vault.decrypted_secrets
                    where name = 'automacao_segredo'),
        'cliente', new.cliente,
        'valor_venda', new.valor_venda,
        'modelo', new.modelo,
        'id', new.id
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
  return new;
end
$function$;

drop trigger if exists trg_push_aceite on public.orcamentos;
create trigger trg_push_aceite
  after update on public.orcamentos
  for each row execute function public.notify_push_aceite();


-- ── 2. Backup semanal ────────────────────────────────────────────────────
-- pg_cron é UTC: '0 6 * * 1' = segunda-feira 03h no horário de Brasília.
-- unschedule idempotente antes, para poder rodar o arquivo mais de uma vez.
select cron.unschedule(jobid) from cron.job where jobname = 'backup-semanal';

select cron.schedule('backup-semanal', '0 6 * * 1', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/backup-semanal',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 55000
  )
$cron$);


-- ── 3. Conferência ───────────────────────────────────────────────────────
-- O job precisa aparecer ativo e o command NÃO pode mais conter o segredo.
select jobid, jobname, schedule, active,
       (command not like '%decrypted_secret%') as ainda_tem_literal
  from cron.job where jobname = 'backup-semanal';

select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.orcamentos'::regclass and tgname = 'trg_push_aceite';

-- Prova de verdade (a resposta da chamada não vale, o estado vale): marque um
-- orçamento de teste como aceito e confira que chegou push, ou espere a segunda
-- e confira `cron.job_run_details` mais um arquivo novo no bucket `backups`.


-- ── Voltar atrás ─────────────────────────────────────────────────────────
-- select cron.unschedule('backup-semanal');
-- drop trigger if exists trg_push_aceite on public.orcamentos;
-- e recriar as duas com o literal, como estavam antes de 26/09.
