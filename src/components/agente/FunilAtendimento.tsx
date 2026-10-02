import { Filter } from 'lucide-react'
import type { Dono, FunilAtendimento as Funil } from '@/lib/analises/funilAtendimento'
import { cn } from '@/lib/utils'

/**
 * Funil do atendimento (Lucca, 02/10): uma fila só, de cima pra baixo, e cada etapa
 * diz de quem é. Todas as barras medem contra o total de conversas do período, então
 * o afunilamento aparece na largura. Ao lado de cada etapa, quanto passou da anterior.
 *
 * Cor (DESIGN.md): laranja = IA, neutro = equipe, emerald = venda lançada no Fechamento,
 * âmbar = convertido que falta lançar. A cor nunca é o único sinal: o selo do dono e o
 * texto embaixo de cada barra dizem a mesma coisa em palavra.
 */

const pct = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 100) : 0)
const largura = (n: number, de: number) => (de > 0 ? Math.max((n / de) * 100, n > 0 ? 1.5 : 0) : 0)

const DONO: Record<Dono, { rotulo: string; cor: string }> = {
  ia:     { rotulo: 'IA',          cor: 'border-primary/25 bg-primary/[0.07] text-primary' },
  ambos:  { rotulo: 'IA + equipe', cor: 'border-primary/25 bg-primary/[0.04] text-foreground/80' },
  equipe: { rotulo: 'Equipe',      cor: 'border-border bg-muted/60 text-foreground/75' },
}

const IA = 'bg-primary'
const AMBOS = 'bg-primary/45'
const EQUIPE = 'bg-foreground/55'
const LANCADO = 'bg-emerald-500'
const FALTA_LANCAR = 'bg-amber-500'

type Parte = { valor: number; cor: string }

function Etapa({ rotulo, dono, total, conversas, anterior, partes, detalhe }: {
  rotulo: string
  dono: Dono
  total: number
  conversas: number
  /** total da etapa de cima; null na primeira */
  anterior: number | null
  partes: Parte[]
  detalhe?: React.ReactNode
}) {
  const d = DONO[dono]
  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr_6.5rem]">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold text-foreground">{rotulo}</span>
        <span className={cn('w-fit rounded-full border px-1.5 py-px text-[10px] font-semibold', d.cor)}>{d.rotulo}</span>
      </div>
      <div className="flex h-7 overflow-hidden rounded-md bg-muted/50" role="img"
        aria-label={`${rotulo}: ${total} de ${conversas} conversas`}>
        {partes.filter(p => p.valor > 0).map((p, i) => (
          <div key={i} className={cn('h-full transition-[width] duration-500 ease-out motion-reduce:transition-none', p.cor)}
            style={{ width: `${largura(p.valor, conversas)}%` }} />
        ))}
      </div>
      <div className="text-right tabular-nums">
        <span className="font-display text-base font-bold text-foreground">{total}</span>
        <span className="ml-1 text-[11px] text-muted-foreground">{pct(total, conversas)}%</span>
        {anterior !== null && (
          <span className="block text-[10px] text-muted-foreground" title="quanto passou da etapa de cima">
            {pct(total, anterior)}% da anterior
          </span>
        )}
      </div>
      {detalhe && <p className="col-span-2 col-start-2 text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  )
}

function Legenda({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="mr-3 inline-flex items-center gap-1 whitespace-nowrap">
      <span className={cn('inline-block h-2 w-2 rounded-sm', cor)} aria-hidden="true" />
      {children}
    </span>
  )
}

export function FunilAtendimento({ funil }: { funil: Funil }) {
  const { conversas, atendeu, orcamento, medicao, converteu } = funil

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Filter className="h-4 w-4 shrink-0 self-center text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Funil do atendimento</h2>
        <span className="text-xs text-muted-foreground">
          de {conversas} conversa{conversas !== 1 ? 's' : ''} · {converteu.total} convertido{converteu.total !== 1 ? 's' : ''} ({pct(converteu.total, conversas)}%)
        </span>
      </div>

      <div className="space-y-4">
        <Etapa rotulo="Atendeu" dono="ia" total={atendeu.total} conversas={conversas} anterior={null}
          partes={[{ valor: atendeu.total, cor: IA }]}
          detalhe={atendeu.soEquipe > 0 && <>a equipe atendeu outras {atendeu.soEquipe} sem a IA</>} />

        <Etapa rotulo="Orçamento" dono="ambos" total={orcamento.total} conversas={conversas}
          anterior={atendeu.total + atendeu.soEquipe}
          partes={[{ valor: orcamento.soIa, cor: IA }, { valor: orcamento.ambos, cor: AMBOS }, { valor: orcamento.soEquipe, cor: EQUIPE }]}
          detalhe={orcamento.total > 0 && <>
            <Legenda cor={IA}>só IA {orcamento.soIa}</Legenda>
            <Legenda cor={AMBOS}>os dois {orcamento.ambos}</Legenda>
            <Legenda cor={EQUIPE}>só equipe {orcamento.soEquipe}</Legenda>
          </>} />

        <Etapa rotulo="Medição" dono="equipe" total={medicao.total} conversas={conversas} anterior={orcamento.total}
          partes={[{ valor: medicao.total, cor: EQUIPE }]} />

        <Etapa rotulo="Converteu" dono="equipe" total={converteu.total} conversas={conversas}
          anterior={medicao.total || orcamento.total}
          partes={[{ valor: converteu.noFechamento, cor: LANCADO }, { valor: converteu.soMarcado, cor: FALTA_LANCAR }]}
          detalhe={converteu.total > 0 && <>
            <Legenda cor={LANCADO}>lançados no Fechamento {converteu.noFechamento}</Legenda>
            {converteu.soMarcado > 0 && (
              <Legenda cor={FALTA_LANCAR}>
                <span className="text-amber-700 dark:text-amber-400">
                  só marcados no WhatsApp {converteu.soMarcado}, falta lançar
                </span>
              </Legenda>
            )}
          </>} />
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Cada lead conta uma vez por etapa: quem foi marcado no WhatsApp e também lançado no Fechamento é um convertido só.
      </p>
    </div>
  )
}
