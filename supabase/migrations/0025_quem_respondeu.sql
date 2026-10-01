-- 0025 — Quem respondeu cada mensagem do cliente: a IA ou a equipe.
--
-- DEPENDE DA 0023 (mensagens_sombrear).
--
-- As mensagens que SAEM já dizem quem escreveu (autor: ia | equipe, e canal_envio:
-- chatwoot | celular). Faltava o lado de quem RECEBEU: para cada mensagem do cliente,
-- quem atendeu. A regra é a primeira mensagem não privada da loja (IA ou equipe) depois
-- dela, na mesma conversa. Várias mensagens seguidas do cliente apontam para a mesma
-- resposta. Sem resposta depois, respondida_por fica null.
--
-- É uma view, não coluna: calcula na hora a partir das mensagens, então nunca fica
-- desatualizada nem depende de processo nenhum. security_invoker faz valer a RLS de
-- mensagens_sombrear (só usuário aprovado lê).

create or replace view public.mensagens_sombrear_respostas
with (security_invoker = true) as
select
  c.id                  as mensagem_id,
  c.conversa_id,
  c.lead_id,
  c.enviada_em          as recebida_em,
  c.conteudo,
  r.autor               as respondida_por,   -- 'ia' | 'equipe' | null
  r.autor_nome          as respondida_por_nome,
  r.canal_envio         as respondida_pelo,  -- 'chatwoot' | 'celular' | null (IA)
  r.id                  as resposta_id,
  r.enviada_em          as respondida_em,
  round((extract(epoch from (r.enviada_em - c.enviada_em)) / 60)::numeric, 1) as minutos_ate_resposta
from public.mensagens_sombrear c
left join lateral (
  select s.id, s.autor, s.autor_nome, s.canal_envio, s.enviada_em
  from public.mensagens_sombrear s
  where s.conversa_id = c.conversa_id
    and s.autor <> 'cliente'
    and not s.privada
    and (s.enviada_em, s.id) > (c.enviada_em, c.id)
  order by s.enviada_em, s.id
  limit 1
) r on true
where c.autor = 'cliente'
  and not c.privada;

grant select on public.mensagens_sombrear_respostas to authenticated;
