import { Filter } from 'lucide-react'
import type { FunilIaEquipe as Funil } from '@/lib/analises/funilIaEquipe'
import { cn } from '@/lib/utils'

/**
 * Funil espelhado (Lucca, 01/10): a Amanda à esquerda, a equipe à direita, a fase no meio.
 * As barras medem contra o total de conversas do período, então os dois lados ficam na
 * mesma escala. Cor da marca só na barra da IA; a da equipe é neutra, e o rótulo em cima
 * de cada lado diz quem é quem (a cor nunca é o único sinal).
 *
 * A barra mantém a transição de largura de 500ms do funil anterior.
 */

const pct = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 100) : 0)
const largura = (n: number, de: number) => `${de > 0 ? Math.max((n / de) * 100, n > 0 ? 4 : 0) : 0}%`

function Numero({ valor, sub, lado, dica }: { valor: number; sub: string; lado: 'ia' | 'equipe'; dica?: string }) {
  return (
    <span title={dica} className={cn('shrink-0 tabular-nums sm:w-[4.5rem]', lado === 'ia' ? 'text-left' : 'text-right')}>
      <span className="font-display text-sm font-bold text-foreground">{valor}</span>
      <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">{sub}</span>
    </span>
  )
}

function Barra({ valor, de, lado, sub, dica }: { valor: number; de: number; lado: 'ia' | 'equipe'; sub: string; dica?: string }) {
  const trilho = (
    <div className={cn('flex h-6 flex-1 overflow-hidden rounded-md bg-muted/50', lado === 'ia' && 'justify-end')}>
      <div
        className={cn('h-full rounded-md transition-all duration-500', lado === 'ia' ? 'bg-primary' : 'bg-foreground/55')}
        style={{ width: largura(valor, de) }}
      />
    </div>
  )
  return (
    <div className="flex min-w-0 items-center gap-2">
      {lado === 'ia' ? <><Numero valor={valor} sub={sub} lado="ia" dica={dica} />{trilho}</> : <>{trilho}<Numero valor={valor} sub={sub} lado="equipe" dica={dica} /></>}
    </div>
  )
}

const meio = 'text-center text-[11px] font-medium leading-[1.1] text-muted-foreground sm:text-xs'

export function FunilIaEquipe({ funil }: { funil: Funil }) {
  const { conversas, etapas, convertidos: cv } = funil
  const orc = etapas.find(e => e.chave === 'orcamento')!
  // título com a conclusão em número (APPLE-HIG §gráfico)
  const conclusao = orc.ia + orc.equipe === 0
    ? 'nenhum orçamento no período'
    : orc.equipe >= orc.ia
      ? `a equipe mandou orçamento para ${orc.equipe}, a IA para ${orc.ia}`
      : `a IA mandou orçamento para ${orc.ia}, a equipe para ${orc.equipe}`
  const notas = [
    cv.nosDois > 0 && `${cv.nosDois} receberam orçamento dos dois e contam nos dois lados`,
    cv.semOrcamento > 0 && `${cv.semOrcamento} sem orçamento no chat`,
  ].filter(Boolean)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Filter className="h-4 w-4 shrink-0 self-center text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Funil IA x equipe</h2>
        <span className="text-xs text-muted-foreground">
          de {conversas} conversa{conversas !== 1 ? 's' : ''} · {conclusao}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_4.5rem_1fr] items-center gap-x-2 gap-y-2 sm:grid-cols-[1fr_9rem_1fr] sm:gap-x-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">IA (Amanda)</span>
        <span />
        <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Equipe</span>

        {etapas.map(e => (
          <div key={e.chave} className="contents">
            <Barra valor={e.ia} de={conversas} lado="ia" sub={`${pct(e.ia, conversas)}%`} />
            <span className={meio}>{e.rotulo}</span>
            <Barra valor={e.equipe} de={conversas} lado="equipe" sub={`${pct(e.equipe, conversas)}%`} />
          </div>
        ))}

        {/* convertidos: o total no meio é a soma dos dois lados; a % de cada lado é sobre
            os leads que aquele lado cotou (quanto do orçamento dele virou venda) */}
        <Barra valor={cv.ia} de={conversas} lado="ia" sub={`${pct(cv.ia, orc.ia)}%`}
          dica={`${pct(cv.ia, orc.ia)}% dos leads que a IA cotou viraram venda`} />
        <span className={cn(meio, 'flex flex-col items-center')}>
          <span className="font-display text-base font-bold tabular-nums text-foreground">{cv.total}</span>
          convertidos
        </span>
        <Barra valor={cv.equipe} de={conversas} lado="equipe" sub={`${pct(cv.equipe, orc.equipe)}%`}
          dica={`${pct(cv.equipe, orc.equipe)}% dos leads que a equipe cotou viraram venda`} />
      </div>

      {notas.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{notas.join(' · ')}</p>
      )}
    </div>
  )
}
