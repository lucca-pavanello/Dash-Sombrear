/**
 * Receitas visuais compartilhadas — a ÚNICA fonte de verdade pra campo de
 * formulário, tabela e controle segmentado.
 *
 * Antes disto cada tela tinha a sua: 5 cabeçalhos de tabela diferentes,
 * 4 inputs, 3 rótulos, 9 trilhos de segmentado. O DESIGN.md descrevia a
 * intenção ("labels 11px uppercase") mas não a receita completa, então cada
 * arquivo completou do seu jeito.
 *
 * Regra: tela nova importa daqui. Precisa de variação? Adiciona AQUI, com
 * nome, e usa em todo lugar. Não copia a string pro componente.
 *
 * Tudo abaixo é só Tailwind — nada de cor literal; os tokens vêm do index.css.
 */

/* ── Campo de formulário ─────────────────────────────────────────────────── */

/** Rótulo acima do campo. 11px, caixa alta, mesmo peso em toda tela. */
export const rotulo =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-foreground/55'

/**
 * Input / select / textarea de formulário.
 * `text-base sm:text-sm`: 16px no celular (iOS não dá zoom no foco), 14px no
 * desktop — era por isso que Simulador usava text-base e Calcular text-sm;
 * agora é o mesmo campo nos dois.
 */
export const campo =
  'w-full rounded-lg border border-border bg-background px-3.5 py-3 text-base sm:text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30'

/** Campo compacto — edição inline dentro de linha de tabela. Mesmo foco, menos altura. */
export const campoCompacto =
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

/** Busca com ícone à esquerda (o pl-9 abre espaço pro ícone). */
export const campoBusca =
  'w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150'

/* ── Tabela ──────────────────────────────────────────────────────────────── */

/**
 * A tabela da Lista de orçamentos é a referência (é a que a loja mais olha).
 * Cabeçalho 11px caixa alta, célula 14px com px-4 py-3 — o DESIGN.md já
 * dizia "px-4 py-3 em células"; agora o cabeçalho também tem receita.
 */
export const tabela = {
  /** wrapper do card que contém a tabela */
  container: 'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
  /** <tr> do thead */
  theadRow: 'border-b border-border bg-muted/40',
  /** <th> */
  th: 'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap',
  /** <th> ordenável — soma ao th */
  thOrdenavel: 'cursor-pointer select-none transition-colors hover:text-foreground',
  /** <tr> do tbody */
  tr: 'border-b border-border/60 last:border-0 transition-colors hover:bg-muted/20',
  /** <td> */
  td: 'px-4 py-3 text-sm align-middle',
  /** célula secundária (data, id): menor e apagada */
  tdApagado: 'px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums',
  /** linha vertical entre colunas — OPCIONAL, só em tabela larga com muita coluna numérica */
  regua: 'border-r border-border/40 last:border-r-0',
  /** <tr> do tfoot */
  tfootRow: 'border-t border-border bg-muted/40',
  tfootCell: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
  /** célula de "nenhum resultado" */
  vazio: 'px-4 py-10 text-center text-sm text-muted-foreground',
} as const

/* ── Controle segmentado (abas pequenas / período / modo) ────────────────── */

/**
 * Mesmo trilho da barra de abas do Dashboard. Ativo = bg-card + texto primária
 * (nunca bg-primary: primária cheia é pra botão de ação, não pra seleção).
 */
export const segmentado = {
  trilho: 'flex gap-1 rounded-xl bg-muted/60 p-1',
  item: 'rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
  ativo: 'bg-card text-primary shadow-sm',
  inativo: 'text-muted-foreground hover:text-foreground hover:bg-card/50',
} as const

/* ── Cartão ──────────────────────────────────────────────────────────────── */

/** Card padrão (DESIGN.md §Componentes). Filtros usam o MESMO card — sem border-2. */
export const cartao = 'rounded-xl border border-border bg-card shadow-sm'

/* ── Card de KPI ─────────────────────────────────────────────────────────── */

/**
 * O card de KPI da Lista de orçamentos é a referência: centrado, chip do
 * ícone em cima, rótulo em caixa alta, número grande em font-display.
 * Agente IA (esquerda, ícone à direita) e Fechamento (sem ícone, rótulo 10px)
 * passam a usar a mesma composição; o Estoque mantém a dele (tem tendência e
 * sparkline) mas com a MESMA tipografia.
 *
 * Acento = borda inteira tingida + banho de fundo (DESIGN.md) — sem border-2,
 * sem listra.
 */
export const kpi = {
  /** moldura neutra */
  cartao: 'rounded-xl border p-4 shadow-sm transition-colors',
  /** acentos — cor é significado, não categoria */
  acento: {
    primario: 'border-primary/25 bg-primary/[0.07] dark:bg-primary/[0.12]',
    emerald:  'border-emerald-500/25 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08]',
    amber:    'border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]',
    neutro:   'border-border bg-card',
  },
  /** chip do ícone (quando houver) */
  chip: 'mb-1.5 inline-flex rounded-lg p-1.5',
  chipCor: {
    primario: 'bg-primary/15 text-primary',
    emerald:  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber:    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    neutro:   'bg-muted text-muted-foreground',
  },
  /** rótulo — a mesma tipografia do cabeçalho de tabela */
  rotulo: 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate',
  /** o número */
  valor: 'font-display mt-1 text-2xl font-bold tracking-tight tabular-nums',
  valorCor: {
    primario: 'text-primary',
    emerald:  'text-emerald-600 dark:text-emerald-400',
    amber:    'text-amber-600 dark:text-amber-400',
    neutro:   'text-foreground',
  },
  /** linha de apoio embaixo do número */
  sub: 'mt-0.5 text-[11px] text-muted-foreground truncate tabular-nums',
} as const
