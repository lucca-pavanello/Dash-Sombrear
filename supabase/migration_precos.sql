-- Precificação 2.0 — fonte da verdade dos preços (paralela à planilha; nada lê daqui ainda)
create table if not exists precos_tecidos (
  id bigint generated always as identity primary key,
  nome text not null, tipo text not null default 'decorativo' check (tipo in ('blackout','tela_solar','decorativo','outro')),
  largura numeric not null, preco numeric not null,
  atualizado_em timestamptz default now(), unique (nome, largura));
create table if not exists precos_tecido_modelos (
  tecido_nome text not null, modelo text not null, primary key (tecido_nome, modelo));
create table if not exists precos_artigos (
  id bigint generated always as identity primary key,
  categoria text not null check (categoria in ('PV','PH_ALUMINIO')), nome text not null, preco numeric not null,
  atualizado_em timestamptz default now(), unique (categoria, nome));
create table if not exists precos_ph50 (
  id bigint generated always as identity primary key,
  modelo text not null, cor text not null, preco_cadarco numeric not null, preco_fita numeric,
  bando_ml numeric, aba_pc numeric, atualizado_em timestamptz default now(), unique (modelo, cor));
create table if not exists precos_ferragem_familias (
  familia text not null, cor text not null, espessura int not null default 0,
  larg_min numeric not null, larg_max numeric not null, passo numeric not null default 0.10,
  primary key (familia, cor, espessura));
create table if not exists precos_ferragem_escada (
  familia text not null, cor text not null, espessura int not null default 0,
  largura numeric not null, custo numeric not null,
  primary key (familia, cor, espessura, largura));
create table if not exists precos_ferragem_componentes (
  id bigint generated always as identity primary key,
  familia text not null, cor text not null, espessura int, item text not null,
  tipo_custo text not null check (tipo_custo in ('por_metro','fixo')), valor numeric not null,
  atualizado_em timestamptz default now());
create table if not exists precos_bandos (
  id bigint generated always as identity primary key,
  cor text not null, largura numeric not null, preco numeric not null, unique (cor, largura));
-- 2026-07-31 (fórmulas, não valores): bandô virou fórmula igual à planilha.
--   preço = largura × preco_metro + qtd_cd × (cd1 + cd2) + par
--   alter table precos_bandos add column qtd_cd int; add column qtd_par int; drop column preco;
create table if not exists precos_bandos_params (
  cor text primary key, preco_metro numeric not null, par numeric not null,
  cd1 numeric not null, cd2 numeric not null, atualizado_em timestamptz default now());
create table if not exists precos_barra_faixas (largura_min numeric primary key, qtd_presilhas int not null);
create table if not exists precos_colocacao (
  id bigint generated always as identity primary key, ml_min numeric not null, ml_max numeric not null, preco numeric not null);
create table if not exists precos_motor_estrutura (
  id bigint generated always as identity primary key,
  largura numeric not null, alt_faixa text not null, valor numeric not null, obs text, grupo text);
create table if not exists precos_motor_componentes (
  id bigint generated always as identity primary key, item text not null unique, custo numeric not null);
create table if not exists precos_parametros (
  chave text primary key, valor numeric not null, descricao text, atualizado_em timestamptz default now());
create table if not exists precos_promocoes (
  id bigint generated always as identity primary key,
  alvo_tipo text not null check (alvo_tipo in ('tecido','artigo','modelo')),
  alvo_nome text not null, desconto_pct numeric not null check (desconto_pct > 0 and desconto_pct < 100),
  inicio date not null, fim date not null, criado_em timestamptz default now());
-- view: preços de tecido com promoção vigente aplicada
create or replace view precos_tecidos_vigentes as
select t.id, t.nome, t.tipo, t.largura,
       round(t.preco * (1 - coalesce(p.desconto_pct, 0) / 100.0), 2) as preco,
       t.preco as preco_cheio, p.desconto_pct,
       (p.id is not null) as em_promocao
  from precos_tecidos t
  left join precos_promocoes p
    on p.alvo_tipo = 'tecido' and p.alvo_nome = t.nome
   and current_date between p.inicio and p.fim;

-- RLS: acesso total apenas para admins (funcao eh_admin_precos + policy *_admin em cada tabela)
-- Aplicado em producao 2026-07-31 via Management API. Seed importado da planilha (455 registros).
-- 2026-07-31 (Romana + espelho completo):
--   create table precos_romana_matriz (largura, altura, custo, pk(largura,altura)) — matriz 31×31
--     importada da planilha "Romana - Sombrear" (doc 1LIgHXggHjiIut5P8xcMt6a0eiMJFm5FLHtqBw-D_jBM,
--     aba Custo M2; as abas "Teste larg. X" são a bancada de trabalho que gera a matriz lá).
--   alter table precos_motor_componentes add column quantidade int;
--   alter table precos_motor_estrutura add column valor_extra numeric; add column ordem int;
create table if not exists precos_romana_matriz (
  largura numeric not null, altura numeric not null, custo numeric not null,
  atualizado_em timestamptz default now(), primary key (largura, altura));
-- 2026-07-31 (fórmulas): precos_ferragem_componentes.tipo_custo agora aceita
--   'opcional_ml'/'opcional_par' (itens à parte, fora da soma da escada — ex.: guias da ROLO BRANCA 50).
--   ROLO BRANCA 50 reimportada por componentes (ml 42,59 + fixo 37,70 — o import antigo lia o bloco
--   de guias como componente e caía pra tabela de valores); precos_ferragem_escada esvaziada.
