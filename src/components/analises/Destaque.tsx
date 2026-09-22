/**
 * O bloco de bater o olho.
 *
 * Quem abre esta aba tem dois segundos de atenção e uma pergunta: "deu resultado?".
 * Quatro cards de igual peso não respondem isso — respondem "aqui estão quatro números".
 * Então o topo passa a ter uma hierarquia explícita: a receita ocupa o espaço de uma
 * manchete, com a trajetória dos últimos meses logo abaixo para que o número tenha
 * contexto sem precisar rolar até o gráfico; ao lado, o resultado do canal, que é o que
 * prova o trabalho de quem traz a gente.
 *
 * A trajetória é de barras e não de linha porque cada mês é uma quantia fechada, não uma
 * medição contínua — linha entre dois meses sugere valores intermediários que não existem.
 *
 * É o único lugar da tela com acento de marca no fundo. Um acento só, no que importa
 * mais: é o que a regra de "laranja em ≤10% da superfície" compra.
 */
import { TrendingUp } from 'lucide-react'
import type { MesReceita, LinhaCanal } from '@/lib/analises'
import { formatCurrency, cn } from '@/lib/utils'
import { NumeroAnimado, Delta } from './base'

/** Seis meses cabem sem virar tira de código de barras. */
function Trajetoria({ meses }: { meses: MesReceita[] }) {
  const maior = Math.max(1, ...meses.map((m) => m.receita))
  const ultimo = meses.length - 1

  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      {meses.map((m, i) => (
        <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-12 w-full items-end">
            <div
              title={`${m.rotulo}: ${formatCurrency(m.receita)}`}
              className={cn(
                'w-full rounded-t-[3px] transition-[height] duration-700 ease-out motion-reduce:transition-none',
                i === ultimo ? 'bg-primary' : 'bg-primary/30',
              )}
              style={{ height: `${Math.max(m.receita > 0 ? 6 : 2, (m.receita / maior) * 100)}%` }}
            />
          </div>
          <span className={cn('text-[10px] font-medium capitalize tabular-nums',
            i === ultimo ? 'text-foreground/70' : 'text-muted-foreground/70')}>
            {m.rotulo}
          </span>
        </div>
      ))}
    </div>
  )
}

function BarraCanal({ rotulo, pct, maior, forte }: {
  rotulo: string
  pct: number
  maior: number
  forte?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={cn('truncate text-xs font-medium',
          forte ? 'text-foreground/80' : 'text-muted-foreground')}>
          {rotulo}
        </span>
        <span className={cn('ml-auto shrink-0 font-display text-base font-bold tabular-nums',
          forte ? 'text-foreground' : 'text-muted-foreground')}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted/70">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none',
            forte ? 'bg-primary' : 'bg-muted-foreground/40')}
          style={{ width: `${maior > 0 ? (pct / maior) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}

export default function Destaque({
  receita, deltaReceita, rotuloComparacao, rotuloPeriodo, meses,
  destaqueCanal, semCanal, taxaOrcamento, orcadas, conversas,
}: {
  receita: number
  deltaReceita: number | null
  rotuloComparacao: string
  rotuloPeriodo: string
  meses: MesReceita[]
  destaqueCanal: { linha: LinhaCanal; vezes: number } | null
  semCanal: LinhaCanal
  taxaOrcamento: number
  orcadas: number
  conversas: number
}) {
  const maiorTaxa = destaqueCanal
    ? Math.max(destaqueCanal.linha.taxaOrcamento, semCanal.taxaOrcamento)
    : 0

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-5 shadow-sm dark:bg-primary/[0.07] lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:p-6">
      <div className="text-center lg:text-left">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/70">
          Receita fechada · {rotuloPeriodo}
        </p>
        <p className="font-display mt-1 text-4xl font-bold leading-none tracking-tight text-primary sm:text-5xl">
          <NumeroAnimado valor={receita} formatar={formatCurrency} duracao={900} />
        </p>
        <div className="mt-2 flex justify-center lg:justify-start">
          <Delta pct={deltaReceita} rotulo={rotuloComparacao} />
        </div>
        {meses.length > 1 && (
          <div className="mt-4 border-t border-primary/15 pt-3">
            <Trajetoria meses={meses} />
          </div>
        )}
      </div>

      <div className="border-t border-primary/15 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        {destaqueCanal ? (
          <>
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold leading-snug text-foreground">
                Quem chega pelo {destaqueCanal.linha.rotulo} pede orçamento{' '}
                <span className="font-display text-lg font-bold tabular-nums text-primary">
                  {destaqueCanal.vezes.toFixed(1)}×
                </span>{' '}
                mais
              </p>
            </div>
            <div className="mt-3 space-y-2.5">
              <BarraCanal rotulo={destaqueCanal.linha.rotulo}
                pct={destaqueCanal.linha.taxaOrcamento} maior={maiorTaxa} forte />
              <BarraCanal rotulo="Chegou sem canal marcado"
                pct={semCanal.taxaOrcamento} maior={maiorTaxa} />
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {destaqueCanal.linha.leads} conversas pelo canal, {semCanal.leads} sem marcação.
              É a comparação que não depende do telefone da venda casar com a conversa.
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
              Conversa → orçamento
            </p>
            <p className="font-display mt-1 text-3xl font-bold tabular-nums text-foreground">
              <NumeroAnimado valor={taxaOrcamento} formatar={(v) => `${v.toFixed(0)}%`} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {orcadas} de {conversas} conversas receberam preço
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Nenhum canal tem conversas suficientes no período para comparar. O canal é
              capturado pela Amanda na primeira mensagem.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
