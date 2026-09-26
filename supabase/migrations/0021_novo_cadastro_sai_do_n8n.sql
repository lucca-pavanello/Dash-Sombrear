-- 0021 — O aviso de novo cadastro deixa de passar pelo n8n.
--
-- DEPENDE DA 0020: usa os segredos `automacao_segredo` e `funcoes_base_url`
-- do Vault. Se a 0020 não rodou, o bloco de guarda abaixo aborta.
--
-- ANTES DE RODAR:
--   1. A Edge Function `novo-cadastro` precisa estar publicada.
--   2. Function Secret `UAZAPI_TOKEN` configurado (Supabase → Edge Functions →
--      Secrets). É o mesmo token que estava escrito à mão dentro do node do
--      n8n `whatsapp | avisar_admin`.
--
-- O QUE MUDA
-- O trigger `notify_n8n_new_user` chamava `supabase_functions.http_request`
-- apontando para o webhook do n8n. Passa a chamar a Edge Function por pg_net,
-- com o segredo compartilhado no corpo.
--
-- Aviso de escopo: o workflow n8n mandava e-mail E WhatsApp. A function manda
-- só WhatsApp — o porquê está no cabeçalho dela.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_segredo')
     or not exists (select 1 from vault.decrypted_secrets where name = 'funcoes_base_url') then
    raise exception 'Rode a 0020 primeiro (segredos do Vault).';
  end if;
end $$;


create or replace function public.notify_novo_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/novo-cadastro',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo'),
      'id',    new.id,
      'nome',  new.full_name,
      'email', new.email
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- o aviso é conveniência; nunca pode derrubar o cadastro. O `handle_new_user`
  -- que insere esta linha já engole exceção pelo mesmo motivo.
  return new;
end
$function$;

drop trigger if exists notify_n8n_new_user on public.profiles;
drop trigger if exists on_new_profile_notify on public.profiles;
drop trigger if exists notify_novo_cadastro on public.profiles;

create trigger notify_novo_cadastro
  after insert on public.profiles
  for each row execute function public.notify_novo_cadastro();


-- ── Conferência ──────────────────────────────────────────────────────────
-- Tem que sobrar UM trigger de aviso, e nenhum apontando para o n8n.
select tgname, pg_get_triggerdef(oid) as def
  from pg_trigger
 where tgrelid = 'public.profiles'::regclass and not tgisinternal;

-- A prova é o estado depois, não esta consulta: crie um usuário de teste e
-- confira que o WhatsApp chegou. Depois apague o usuário de teste.


-- ── Voltar atrás ─────────────────────────────────────────────────────────
-- drop trigger if exists notify_novo_cadastro on public.profiles;
-- create trigger notify_n8n_new_user after insert on public.profiles
--   for each row execute function supabase_functions.http_request(
--     'https://n8n-n8n.yjlhot.easypanel.host/webhook/sombrear-novo-cadastro',
--     'POST', '{"Content-type":"application/json"}', '{}', '5000');
-- (e reativar o workflow MWK2JKqYbo3xpQD3 no n8n, se tiver sido desativado)
