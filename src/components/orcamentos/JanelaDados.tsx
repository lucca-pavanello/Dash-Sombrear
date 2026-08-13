/**
 * Aviso discreto de quanto histórico está carregado, com atalho pra trocar.
 *
 * Existe porque a busca passou a ser limitada por período (janelaDados.ts):
 * se alguém procura uma venda de dois anos atrás e ela não aparece, a linha
 * aqui explica o porquê em vez de deixar a pessoa achando que sumiu.
 */
import { Clock } from 'lucide-react'

import { definirJanela, JANELA_PADRAO, JANELA_TUDO, rotuloDaJanela, useJanela } from '@/lib/janelaDados'
import { cn } from '@/lib/utils'

export default function JanelaDados({ className }: { className?: string }) {
  const janela = useJanela()
  const tudo = janela === JANELA_TUDO

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground', className)}>
      <Clock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      <span>Mostrando {rotuloDaJanela(janela)}.</span>
      <button
        type="button"
        onClick={() => definirJanela(tudo ? JANELA_PADRAO : JANELA_TUDO)}
        className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {tudo ? 'Voltar aos últimos 12 meses' : 'Ver histórico completo'}
      </button>
    </div>
  )
}
