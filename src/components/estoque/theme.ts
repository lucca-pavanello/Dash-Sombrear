// Tokens semânticos do módulo de estoque
// Referência única de paleta — use aqui, não hardcode cores nos componentes
export const estoqueTheme = {
  // Níveis de alerta (ponto de pedido, sugestão de compra, etc.)
  ruptura:  'border-l-4 border-red-600 bg-red-50 dark:bg-red-950/30',
  critico:  'border-l-4 border-red-500 bg-red-50/60 dark:bg-red-950/20',
  atencao:  'border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20',
  ok:       '',   // sem cor — ausência de cor já comunica "tudo bem"
  sem_dados: 'text-muted-foreground italic',

  // Badges de classificação ABC
  classeA:  'bg-primary/10 text-primary font-semibold',
  classeB:  'bg-muted text-foreground',
  classeC:  'bg-muted/60 text-muted-foreground text-xs',
  semDados: 'text-muted-foreground italic text-xs',

  // Níveis de localização (cinza escalonado: escuro = mais acessível)
  balcao:    'text-gray-800 font-semibold',
  acessivel: 'text-gray-700',
  medio:     'text-gray-500',
  fundo:     'text-gray-400',
  deposito:  'text-gray-300',
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
