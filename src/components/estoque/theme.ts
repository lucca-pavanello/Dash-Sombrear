// Tokens semânticos do módulo de estoque
// Referência única de paleta — use aqui, não hardcode cores nos componentes
export const estoqueTheme = {
  // Níveis de alerta (ponto de pedido, sugestão de compra, etc.)
  // Banho de fundo sutil no lugar da listra lateral (anti-padrão de design)
  ruptura:  'bg-destructive/[0.07] dark:bg-destructive/[0.12]',
  critico:  'bg-destructive/[0.04] dark:bg-destructive/[0.07]',
  atencao:  'bg-muted/50',
  ok:       '',   // sem cor — ausência de cor já comunica "tudo bem"
  sem_dados: 'text-muted-foreground italic',

  // Badges de classificação ABC
  classeA:  'bg-primary/10 text-primary font-semibold',
  classeB:  'bg-muted text-foreground',
  classeC:  'bg-muted/60 text-muted-foreground text-xs',
  semDados: 'text-muted-foreground italic text-xs',

  // Níveis de localização (escala de contraste: mais forte = mais acessível)
  // Tokens do tema em vez de gray-N fixo — gray-800 sumia sobre o card no dark mode
  balcao:    'text-foreground font-semibold',
  acessivel: 'text-foreground/80',
  medio:     'text-muted-foreground',
  fundo:     'text-muted-foreground/75',
  deposito:  'text-muted-foreground/55',
} as const

export type NivelAlerta = 'ruptura' | 'critico' | 'atencao' | 'ok' | 'sem_dados'
export type ClasseAbc = 'A' | 'B' | 'C' | 'sem_dados'

export function nivelAlertaRow(nivel: NivelAlerta): string {
  return estoqueTheme[nivel] ?? ''
}

export function classeAbcBadge(classe: ClasseAbc | null | undefined): string {
  if (classe === 'A') return estoqueTheme.classeA
  if (classe === 'B') return estoqueTheme.classeB
  if (classe === 'C') return estoqueTheme.classeC
  return estoqueTheme.semDados
}
