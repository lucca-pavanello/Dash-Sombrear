-- Todas as mensagens do WhatsApp da Sombrear, copiadas do Chatwoot (conta 1).
--
-- Antes, o banco só tinha a memória da Amanda (n8n_chat_histories: IA e cliente, com
-- instruções internas misturadas e as linhas antigas apagadas) e as falas da equipe
-- coladas como texto dentro de crm_sombrear_ia.resumo_conversa, que a IA reescreve a
-- cada leitura. Nenhum dos dois servia de registro.
--
-- Quem escreve aqui é só a edge function `mensagens-chatwoot` (service role): pelo
-- webhook do Chatwoot a cada mensagem, e pela sincronização que relê conversas inteiras.
-- A chave é o id da mensagem no Chatwoot, então reler nunca duplica.

create table if not exists public.mensagens_sombrear (
  id            bigint primary key,                 -- id da mensagem no Chatwoot
  conversa_id   bigint not null,                    -- id da conversa no Chatwoot
  inbox_id      integer,
  lead_id       uuid references public.crm_sombrear_ia(id) on delete set null,
  telefone      text,                               -- do contato, como o Chatwoot guarda
  autor         text not null check (autor in ('cliente', 'ia', 'equipe')),
  autor_nome    text,                               -- Stella, Amanda… null quando veio do celular
  -- equipe: 'chatwoot' (digitado no Chatwoot) ou 'celular' (mandado pelo WhatsApp da loja e
  -- devolvido ao Chatwoot como cópia). Para cliente e IA fica null.
  canal_envio   text check (canal_envio in ('chatwoot', 'celular')),
  privada       boolean not null default false,     -- nota interna do Chatwoot (cliente não vê)
  conteudo      text,
  tipo_conteudo text,
  anexos        jsonb not null default '[]'::jsonb, -- [{tipo, url, nome}]
  excluida      boolean not null default false,
  responde_a    bigint,                             -- id da mensagem citada, quando houver
  enviada_em    timestamptz not null,
  gravada_em    timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists mensagens_sombrear_conversa_idx on public.mensagens_sombrear (conversa_id, enviada_em);
create index if not exists mensagens_sombrear_lead_idx on public.mensagens_sombrear (lead_id, enviada_em);
create index if not exists mensagens_sombrear_enviada_idx on public.mensagens_sombrear (enviada_em desc);

alter table public.mensagens_sombrear enable row level security;

-- mesma regra do CRM: só usuário aprovado lê; ninguém do app escreve
drop policy if exists mensagens_ver on public.mensagens_sombrear;
create policy mensagens_ver on public.mensagens_sombrear
  for select to authenticated using (eh_aprovado());
