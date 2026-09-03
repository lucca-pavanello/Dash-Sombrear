-- Insights da Amanda: etiquetas por conversa, pra contagem parar de ser prosa.
--
-- Até aqui o card de Insights mandava 40 conversas pro Gemini e recebia um TEXTO, que
-- ia cru pra tela. Texto não se conta, não se agrupa por produto, não se filtra por
-- período e não tem identidade estável — a cada clique a redação muda, então "essa
-- melhoria eu já resolvi" não tinha em que se apoiar. Estas colunas são o que muda
-- isso: a IA etiqueta cada conversa com slugs de uma lista fixa
-- (src/lib/insights/taxonomia.ts) e o dash faz a aritmética localmente, de graça e sem
-- reprocessar nada a cada troca de filtro.
--
-- Quem escreve: a Edge Function `classificar-conversas`, com service_role (não passa
-- por RLS), na MESMA passada de Gemini que já roda hoje — zero chamada a mais.
--
-- Não confundir com a coluna `objecoes` (texto livre) que já existe: aquela veio da
-- importação do histórico da loja e continua intacta, servindo de INSUMO pro
-- classificador. As novas são o resultado estruturado.

alter table public.crm_sombrear_ia
  add column if not exists objecao_tags        text[],
  add column if not exists objecao_outro       text,
  add column if not exists produto_familia     text,
  add column if not exists sensibilidade_preco text;

comment on column public.crm_sombrear_ia.objecao_tags is
  'Slugs de src/lib/insights/taxonomia.ts (0..N por conversa). Escrito por classificar-conversas.';
comment on column public.crm_sombrear_ia.objecao_outro is
  'Texto livre quando a objeção não coube em nenhum slug (tag "outro"). Fila de descoberta de categoria nova.';
comment on column public.crm_sombrear_ia.produto_familia is
  'Slug de src/lib/produtos.ts. NULL = não deu pra identificar — nunca chutar produto numa contagem.';
comment on column public.crm_sombrear_ia.sensibilidade_preco is
  'baixa | media | alta — o quanto o preço pesou nessa conversa.';

-- GIN porque objecao_tags é array e a pergunta natural é "quais conversas têm a tag X".
-- Hoje o dash filtra no cliente (puxa a tabela inteira), mas o índice já deixa pronto o
-- dia em que a contagem virar query — e a tabela só cresce.
create index if not exists idx_crm_objecao_tags on public.crm_sombrear_ia using gin (objecao_tags);
create index if not exists idx_crm_produto_familia on public.crm_sombrear_ia (produto_familia);

-- RLS: a tabela já tem policies (supabase/seguranca_rls.sql:84-90 — crm_ver/crm_atualizar,
-- ambas via eh_aprovado()). Coluna nova entra sob a policy existente, nada a criar aqui.
