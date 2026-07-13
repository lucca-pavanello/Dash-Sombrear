-- CTA "Aceitar orçamento" na página pública (/orcamento/:id)
-- Coluna de aceite + RPC security definer para o cliente (anon) registrar o aceite
-- sem precisar de policy de UPDATE aberta na tabela.

alter table public.orcamentos add column if not exists aceito_em timestamptz;

create or replace function public.aceitar_orcamento_publico(p_id uuid)
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.orcamentos
     set aceito_em = coalesce(aceito_em, now())
   where id = p_id
     and share_enabled = true
  returning aceito_em;
$$;

revoke all on function public.aceitar_orcamento_publico(uuid) from public;
grant execute on function public.aceitar_orcamento_publico(uuid) to anon, authenticated;
