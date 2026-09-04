-- Fundação para anunciar sobras no Mercado Livre (Persianas de Fábrica).
--
-- Escopo desta migration: só o DADO. Publicar de fato depende de credencial do ML e de
-- uma prova de fogo (publicar UM anúncio à mão pela API) que ainda não aconteceu — porque
-- três respostas podem mudar o desenho e nenhuma delas se descobre sem token na mão:
-- foto é mesmo obrigatória, que frete a categoria MLB4771 aceita, e se anúncios quase
-- idênticos sobrevivem à moderação por duplicidade.
--
-- O que já está confirmado na API pública do ML e justifica os campos abaixo:
--   category_id MLB4771 · título máx. 60 chars · máx. 12 fotos
--   obrigatórios: BRAND, CURTAIN_AND_BLIND_TYPE, HEIGHT, WIDTH, IS_BLACK_OUT
--   shipping_options: ["custom"]  (sem transportadora — frete a combinar/retirada)

-- ── 1) A sobra ganha o que um anúncio precisa ────────────────────────────────
alter table public.estoque_sobras
  add column if not exists loja           text not null default 'persianas_de_fabrica',
  add column if not exists preco_ml       numeric(10,2),
  add column if not exists titulo         text,
  add column if not exists descricao      text,
  add column if not exists ml_item_id     text,
  add column if not exists ml_status      text,
  add column if not exists ml_permalink   text,
  add column if not exists publicado_em   timestamptz,
  add column if not exists peso_g         integer,
  add column if not exists pacote_cm      text;

-- `loja` é a PRIMEIRA coluna de loja do sistema inteiro. Nasce aqui porque sem ela não dá
-- pra saber por qual conta do ML anunciar quando a Sombrear e a Persianas de Fábrica
-- passarem a dividir o dash — e o estoque já é compartilhado hoje.
comment on column public.estoque_sobras.loja is
  'Qual loja vende esta peça. Primeira coluna de loja do sistema — o multi-loja ainda não existe no resto do dash.';
comment on column public.estoque_sobras.titulo is
  'Título do anúncio. Máx. 60 chars (limite da categoria MLB4771) e NÃO pode conter a palavra "estoque" — o ML modera.';
comment on column public.estoque_sobras.ml_item_id is
  'MLB... devolvido no POST /items. Sem ele não dá pra pausar o anúncio quando a peça vender no balcão.';
comment on column public.estoque_sobras.pacote_cm is
  'Dimensões do pacote ENROLADO (CxLxA), não da peça aberta. O rolo tem o comprimento da LARGURA da peça.';

create index if not exists idx_sobras_ml_item on public.estoque_sobras (ml_item_id) where ml_item_id is not null;
create index if not exists idx_sobras_loja    on public.estoque_sobras (loja);

-- ── 2) Tabela de preço do Mercado Livre ──────────────────────────────────────
-- Separada das ~25 tabelas `precos_*` de propósito: aquelas calculam venda sob medida a
-- partir de vão + modelo + markup. Sobra é peça pronta, com preço de liquidação, que não
-- sai de fórmula nenhuma — quem define é a loja.
create table if not exists public.precos_ml (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  familia       text not null,
  abertura      text,
  -- cor nula = vale pra todas as cores daquele tecido. Assim dá pra ter um preço geral e
  -- só abrir exceção onde a cor realmente muda o valor, em vez de preencher 30 linhas.
  cor           text,
  preco_m2      numeric(10,2) not null check (preco_m2 > 0),
  -- piso por anúncio: peça pequena não pode sair por um valor que não paga a comissão do
  -- ML nem o trabalho de embalar
  preco_minimo  numeric(10,2) not null default 0 check (preco_minimo >= 0),
  ativo         boolean not null default true,
  atualizado_por text
);

create unique index if not exists idx_precos_ml_chave
  on public.precos_ml (familia, coalesce(abertura, ''), coalesce(cor, ''));

comment on table public.precos_ml is
  'Preço das sobras no Mercado Livre. preco do anúncio = max(area_m2 * preco_m2, preco_minimo).';
comment on column public.precos_ml.cor is
  'NULL = vale para todas as cores dessa família/abertura. Linha com cor preenchida tem precedência.';

-- ── 3) Fotos por tecido (não por peça) ───────────────────────────────────────
-- São ~30 combinações de tecido+cor, não 153 peças: todas as sobras do mesmo tecido
-- compartilham o mesmo jogo de fotos. É o que torna "publicar sozinho" viável.
create table if not exists public.sobras_fotos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default timezone('utc', now()),
  familia     text not null,
  abertura    text,
  cor         text not null,
  tipo        text not null check (tipo in ('fundo_branco', 'zoom', 'ambiente', 'explicativa')),
  url         text not null,
  ordem       smallint not null default 0,
  ativo       boolean not null default true
);

create unique index if not exists idx_sobras_fotos_chave
  on public.sobras_fotos (familia, coalesce(abertura, ''), cor, tipo);
create index if not exists idx_sobras_fotos_busca on public.sobras_fotos (familia, cor) where ativo;

comment on table public.sobras_fotos is
  'Fotos por tecido+cor, reaproveitadas em todos os anúncios daquele tecido. 1200x1200, JPG/PNG, URL pública.';
comment on column public.sobras_fotos.tipo is
  'fundo_branco é a capa (aparece na busca do ML). As outras completam: zoom da textura, ambiente e explicativa.';

-- ── 4) RLS, no padrão restrito do setup_estoque.sql ──────────────────────────
alter table public.precos_ml    enable row level security;
alter table public.sobras_fotos enable row level security;

drop policy if exists precos_ml_ver     on public.precos_ml;
drop policy if exists precos_ml_inserir on public.precos_ml;
drop policy if exists precos_ml_editar  on public.precos_ml;
drop policy if exists precos_ml_excluir on public.precos_ml;
create policy precos_ml_ver     on public.precos_ml for select to authenticated using (public.eh_aprovado());
create policy precos_ml_inserir on public.precos_ml for insert to authenticated with check (public.eh_aprovado());
create policy precos_ml_editar  on public.precos_ml for update to authenticated using (public.eh_aprovado()) with check (public.eh_aprovado());
create policy precos_ml_excluir on public.precos_ml for delete to authenticated using (public.eh_admin());

drop policy if exists sobras_fotos_ver     on public.sobras_fotos;
drop policy if exists sobras_fotos_inserir on public.sobras_fotos;
drop policy if exists sobras_fotos_editar  on public.sobras_fotos;
drop policy if exists sobras_fotos_excluir on public.sobras_fotos;
create policy sobras_fotos_ver     on public.sobras_fotos for select to authenticated using (public.eh_aprovado());
create policy sobras_fotos_inserir on public.sobras_fotos for insert to authenticated with check (public.eh_aprovado());
create policy sobras_fotos_editar  on public.sobras_fotos for update to authenticated using (public.eh_aprovado()) with check (public.eh_aprovado());
create policy sobras_fotos_excluir on public.sobras_fotos for delete to authenticated using (public.eh_admin());
