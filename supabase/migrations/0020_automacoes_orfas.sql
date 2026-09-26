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
-- ANTES DE RODAR — três passos, nesta ordem:
--
-- 1. ROTACIONE o segredo. O valor atual está exposto no banco desde sempre;
--    migrar o valor velho para o Vault esconde, mas não desqueima. Gere um novo
--    (ex.: `openssl rand -base64 32`).
--
-- 2. Ponha o valor NOVO em Supabase → Edge Functions → Secrets, na variável
--    `PUSH_TRIGGER_SECRET`. As funções `push-aceite` e `backup-semanal` comparam
--    contra ela. (Não precisa redeploy: secret é lido em tempo de execução.)
--
-- 3. Rode os dois comandos abaixo com o MESMO valor novo, aqui no SQL Editor.
--    Eles não estão no corpo da migration de propósito — segredo não entra em
--    arquivo versionado.
--
--    select vault.create_secret('<VALOR NOVO>', 'automacao_segredo');
--    select vault.create_secret(
--      'https://nlswyjpjzibuvdsaooyg.supabase.co/functions/v1', 'funcoes_base_url');
--
-- Só então rode o resto deste arquivo.
-- Entre o passo 2 e o fim desta migration, push de aceite e backup ficam com o
-- segredo velho e falham com 401. A janela é de segundos se rodar em sequência;
-- o backup só roda segunda 06:00 UTC, então na prática só o push está em risco.
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
