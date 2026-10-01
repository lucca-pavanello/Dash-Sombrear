-- 0026 — Orçamentos mandados no chat, separados por quem mandou (IA ou equipe).
--
-- DEPENDE DA 0020 (Vault) e da 0023 (mensagens_sombrear).
-- ANTES DE RODAR: Edge Function `classificar-orcamentos` publicada (usa META_API_KEY).
--
-- POR QUE (medido em 01/10/2026): o dash só enxergava a cotação da IA
-- (ultimo_valor_cotado e orcamentos_sombrear_ia). A equipe manda orçamento direto no
-- WhatsApp, pelo Chatwoot ou pelo celular, e a calculadora do dash quase nunca guarda o
-- telefone (6 de 97), então não dá para ligar ao lead. Resultado: 81 leads cotados só
-- pela equipe apareciam como "não cotados".
--
-- Toda mensagem da loja com valor em R$ passa por uma leitura da IA (Lucca, 01/10): é
-- orçamento para o cliente, ou outro assunto (costureira, frete, peça)? O veredito fica
-- aqui, uma linha por mensagem. A conversão continua sendo da equipe: quem fecha é a loja.

create table if not exists public.orcamentos_chat (
  mensagem_id    bigint primary key references public.mensagens_sombrear(id) on delete cascade,
  conversa_id    bigint not null,
  lead_id        uuid references public.crm_sombrear_ia(id) on delete set null,
  autor          text not null check (autor in ('ia', 'equipe')),
  canal_envio    text,                    -- chatwoot | celular | null (IA)
  enviado_em     timestamptz not null,
  eh_orcamento   boolean not null,        -- false = tem preço mas não é orçamento pro cliente
  valor          numeric,                 -- total da opção principal (a primeira, quando há várias)
  opcoes         integer,                 -- quantas opções de preço a mensagem trouxe
  produto        text,
  classificado_em timestamptz not null default now()
);

create index if not exists orcamentos_chat_lead_idx on public.orcamentos_chat (lead_id, enviado_em);

alter table public.orcamentos_chat enable row level security;
drop policy if exists orcamentos_chat_ver on public.orcamentos_chat;
create policy orcamentos_chat_ver on public.orcamentos_chat
  for select to authenticated using (eh_aprovado());


-- ── Mensagens com preço ainda não lidas ──────────────────────────────────
-- Valor em reais com pelo menos 2 dígitos ("R$ 42", "R$1.362,40"). Com contexto: as duas
-- mensagens anteriores da conversa, para a IA saber do que se fala.
create or replace function public.mensagens_com_preco_pendentes(limite integer default 40)
returns table (id bigint, conversa_id bigint, lead_id uuid, autor text, canal_envio text,
               enviada_em timestamptz, conteudo text, contexto text)
language sql
stable
security definer
set search_path = public
as $function$
  select m.id, m.conversa_id, m.lead_id, m.autor, m.canal_envio, m.enviada_em, m.conteudo,
    (select string_agg(case when a.autor = 'cliente' then 'CLIENTE: ' else 'LOJA: ' end
                       || left(coalesce(a.conteudo, ''), 300), E'\n' order by a.enviada_em)
       from (select p.autor, p.conteudo, p.enviada_em from mensagens_sombrear p
             where p.conversa_id = m.conversa_id and not p.privada
               and (p.enviada_em, p.id) < (m.enviada_em, m.id)
             order by p.enviada_em desc, p.id desc limit 2) a)
  from mensagens_sombrear m
  where m.autor in ('ia', 'equipe')
    and not m.privada and not m.excluida
    and m.conteudo ~ 'R\$ ?[0-9]{2}'
    and not exists (select 1 from orcamentos_chat o where o.mensagem_id = m.id)
  order by m.enviada_em
  limit limite
$function$;

revoke all on function public.mensagens_com_preco_pendentes(integer) from public, anon, authenticated;
grant execute on function public.mensagens_com_preco_pendentes(integer) to service_role;


-- ── Disparo e cron (a cada 15 minutos) ───────────────────────────────────
create or replace function public.disparar_classificar_orcamentos()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'funcoes_base_url') || '/classificar-orcamentos',
    body := jsonb_build_object(
      'segredo', (select decrypted_secret from vault.decrypted_secrets
                  where name = 'automacao_segredo')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );
end
$function$;

select cron.unschedule(jobid) from cron.job where jobname = 'classificar-orcamentos';
select cron.schedule('classificar-orcamentos', '5,20,35,50 * * * *',
  $cron$ select public.disparar_classificar_orcamentos() $cron$);
