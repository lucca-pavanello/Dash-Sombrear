import { tabela, campoBusca } from '@/components/shared/estilos'

/**
 * Tokens de tabela do Estoque. Desde 2026-08-19 DERIVAM da receita
 * compartilhada em `components/shared/estilos.ts` — este arquivo só soma o
 * que é específico do estoque (régua vertical entre colunas, botões de ação).
 * Mudou a receita lá, muda aqui junto.
 */
export const tbl = {
  container:   tabela.container,
  toolbar:     'flex items-center gap-3 border-b border-border px-4 py-3',
  filterRow:   'flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-3',
  searchWrap:  'relative flex-1 max-w-3xl',
  searchIcon:  'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60',
  searchInput: campoBusca + ' h-10',
  addBtn:      'flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 transition-all shrink-0',
  theadRow:    'sticky top-0 z-10 ' + tabela.theadRow,
  // tabelas do estoque são largas e numéricas: levam a régua vertical, centradas
  th:          tabela.th + ' ' + tabela.regua + ' text-center',
  tbodyRow:    tabela.tr + ' duration-150',
  td:          tabela.td + ' text-foreground ' + tabela.regua + ' text-center',
  tfootRow:    tabela.tfootRow,
  tfootCell:   tabela.tfootCell,
  actionTd:    'px-4 py-3 text-center',
  actionGroup: 'flex items-center justify-end gap-2',
  actionBtn:   'rounded-lg h-9 w-9 p-0 flex items-center justify-center text-muted-foreground/60 transition-colors',
}
