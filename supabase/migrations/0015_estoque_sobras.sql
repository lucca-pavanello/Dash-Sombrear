-- Sobras: peça pronta que sobrou de produção e não vai ser refeita.
--
-- Por que uma tabela nova e não `estoque_produtos`: aquela guarda SALDO ESCALAR
-- (quantidade_atual + unidade m/m2/un/kg) de insumo de compra. O único campo dimensional
-- lá é `largura_padrao_cm`, que é a largura do ROLO, não de uma peça. Sobra é o oposto:
-- é uma peça específica, com largura E altura próprias, que existe uma vez só. Enfiar
-- isso em estoque_produtos exigiria uma linha por peça com quantidade 1 e as medidas em
-- texto — perderia a capacidade de filtrar "tenho algo de pelo menos 1,20 x 2,30", que é
-- a única pergunta que o vendedor faz aqui.
--
-- Campos estruturados (familia/abertura/cor) em vez de um nome solto porque a MESMA coisa
-- aparece escrita de dois jeitos nas fontes: "3% BEGE" nas folhas soltas e "Tela solar
-- Bege 3%" no caderno. Separado, dá pra contar e filtrar; junto, viraria texto livre
-- impossível de agrupar. Também deixa a porta aberta pra a Amanda consultar isso um dia
-- sem precisar de migration nova (hoje, por decisão, ela NÃO consulta).

create table if not exists public.estoque_sobras (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  familia      text not null,
  abertura     text,
  cor          text not null,
  largura_m    numeric(6,3) not null check (largura_m > 0),
  altura_m     numeric(6,3) not null check (altura_m  > 0),
  -- coluna GERADA: o dash calcula área inline em 3 lugares diferentes e não tem helper
  -- compartilhado. Deixar o banco calcular evita criar a quarta cópia e garante que
  -- ordenar por tamanho nunca diverge do número exibido.
  area_m2      numeric(9,4) generated always as (largura_m * altura_m) stored,
  -- 'status' em vez do 'ativo' booleano do resto do módulo: aqui vendida e reservada são
  -- estados de negócio distintos que o vendedor precisa enxergar. Nada é apagado —
  -- peça vendida vira histórico.
  status       text not null default 'disponivel'
                 check (status in ('disponivel', 'reservada', 'vendida')),
  observacao   text,
  -- de qual folha/página do caderno a linha veio: a carga inicial é transcrição de FOTO,
  -- e isso é o que permite voltar ao papel e conferir um número que pareça estranho.
  origem       text,
  vendida_em   date,
  user_id      uuid references auth.users(id) on delete set null
);

comment on table public.estoque_sobras is
  'Peças prontas que sobraram de produção — última unidade, não se refaz. Lida pelos vendedores no dash.';

-- MEDIDA FINAL, NÃO MEDIDA DE VÃO. A peça já existe cortada, então o número aqui é o
-- tamanho real dela. No fluxo normal da loja o cliente informa o VÃO e a peça sai maior;
-- aqui esse passo já aconteceu. Quem for casar sobra com pedido um dia precisa lembrar
-- que os dois lados falam línguas diferentes: o cliente dá vão, a sobra é final.
comment on column public.estoque_sobras.largura_m is
  'Medida FINAL da peça pronta, não do vão. Nunca aplicar acréscimo de vão sobre este valor.';
comment on column public.estoque_sobras.altura_m is
  'Medida FINAL da peça pronta, não do vão. Nunca aplicar acréscimo de vão sobre este valor.';
comment on column public.estoque_sobras.area_m2 is
  'largura x altura, multiplicação pura. NÃO é área de cobrança: o piso de 1,20 m2 (1,50 na PV) do motor é regra de preço, não de tamanho.';
comment on column public.estoque_sobras.origem is
  'Folha/página de origem da transcrição — serve pra auditar a leitura das fotos.';

create index if not exists idx_sobras_status   on public.estoque_sobras (status);
create index if not exists idx_sobras_familia  on public.estoque_sobras (familia, cor);
create index if not exists idx_sobras_medidas  on public.estoque_sobras (largura_m, altura_m);

alter table public.estoque_sobras enable row level security;

-- RLS pelo padrão restrito do setup_estoque.sql (perfil aprovado lê e escreve, delete só
-- admin) e NÃO pelo `auth_all` das migrations recentes de estoque, que libera FOR ALL a
-- qualquer autenticado — inclusive não aprovado. Dado de estoque não deve ficar assim.
drop policy if exists sobras_ver     on public.estoque_sobras;
drop policy if exists sobras_inserir on public.estoque_sobras;
drop policy if exists sobras_editar  on public.estoque_sobras;
drop policy if exists sobras_excluir on public.estoque_sobras;

create policy sobras_ver     on public.estoque_sobras for select to authenticated using (public.eh_aprovado());
create policy sobras_inserir on public.estoque_sobras for insert to authenticated with check (public.eh_aprovado());
create policy sobras_editar  on public.estoque_sobras for update to authenticated using (public.eh_aprovado()) with check (public.eh_aprovado());
create policy sobras_excluir on public.estoque_sobras for delete to authenticated using (public.eh_admin());
