import { CalendarCheck, FileText, Handshake, MessageCircle, type LucideIcon } from 'lucide-react'
import type { Dono, FunilAtendimento as Funil } from '@/lib/analises/funilAtendimento'
import { cn } from '@/lib/utils'

/**
 * Funil do atendimento (Lucca, 02/10): desenhado como uma PERSIANA, que é o que a
 * Sombrear vende. Um bandô em cima e as etapas como lâminas que vão afinando, com o
 * respiro entre elas, do laranja queimado ao claro da marca (tokens --funil-* no
 * index.css, uma tinta medida por lâmina e por modo). Ao lado de cada lâmina, ligado por
 * uma linha, de quem é a etapa e quanto passou.
 *
 * A largura da lâmina é desenho, não medida: o número dentro dela e as porcentagens ao
 * lado é que dizem o tamanho. Proporcional, a lâmina de "Converteu" ficaria fina demais
 * pra caber o próprio número.
 */

const pct = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 100) : 0)

/** quanto cada lâmina recua de cada lado, em % da coluna */
const RECUO = 7.5

const LAMINA = [
  'bg-funil-1 text-funil-1-tinta',
  'bg-funil-2 text-funil-2-tinta',
  'bg-funil-3 text-funil-3-tinta',
  'bg-funil-4 text-funil-4-tinta',
] as const

/** só a cor, pra o quadradinho que liga o texto à lâmina no celular */
const COR_LAMINA = ['bg-funil-1', 'bg-funil-2', 'bg-funil-3', 'bg-funil-4'] as const

const DONO: Record<Dono, { rotulo: string; cor: string }> = {
  ia:     { rotulo: 'IA',          cor: 'border-primary/30 bg-primary/[0.08] text-primary' },
  ambos:  { rotulo: 'IA + equipe', cor: 'border-primary/25 bg-primary/[0.04] text-foreground/80' },
  equipe: { rotulo: 'Equipe',      cor: 'border-border bg-muted/70 text-foreground/75' },
}

type Parte = { rotulo: string; valor: number; cor: string; destaque?: boolean }

type Etapa = {
  rotulo: string
  icone: LucideIcon
  dono: Dono
  total: number
  /** total da etapa de cima; null na primeira */
  anterior: number | null
  /** divisão da etapa, mostrada numa barrinha embaixo */
  partes?: Parte[]
  nota?: string
}

/** a barrinha de divisão: proporção entre as partes, com legenda escrita (cor nunca sozinha) */
function Divisao({ partes }: { partes: Parte[] }) {
  const soma = partes.reduce((s, p) => s + p.valor, 0)
  if (soma === 0) return null
  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 w-full max-w-[220px] gap-[2px] overflow-hidden rounded-full">
        {partes.filter(p => p.valor > 0).map(p => (
          <div key={p.rotulo} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.cor)}
            style={{ width: `${(p.valor / soma) * 100}%` }} />
        ))}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] text-muted-foreground">
        {partes.map(p => (
          <span key={p.rotulo} className={cn('inline-flex items-center gap-1 whitespace-nowrap',
            p.destaque && p.valor > 0 && 'font-medium text-amber-700 dark:text-amber-400')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', p.cor)} aria-hidden="true" />
            {p.rotulo} <span className="tabular-nums">{p.valor}</span>
          </span>
        ))}
      </p>
    </div>
  )
}

export function FunilAtendimento({ funil }: { funil: Funil }) {
  const { conversas, atendeu, orcamento, medicao, converteu } = funil

  const etapas: Etapa[] = [
    {
      rotulo: 'Atendeu', icone: MessageCircle, dono: 'ia', total: atendeu.total, anterior: null,
      nota: atendeu.soEquipe > 0 ? `outras ${atendeu.soEquipe} a equipe atendeu sem a IA` : undefined,
    },
    {
      rotulo: 'Orçamento', icone: FileText, dono: 'ambos', total: orcamento.total,
      anterior: atendeu.total + atendeu.soEquipe,
      partes: [
        { rotulo: 'só IA', valor: orcamento.soIa, cor: 'bg-primary' },
        { rotulo: 'os dois', valor: orcamento.ambos, cor: 'bg-primary/45' },
        { rotulo: 'só equipe', valor: orcamento.soEquipe, cor: 'bg-foreground/50' },
      ],
    },
    { rotulo: 'Medição', icone: CalendarCheck, dono: 'equipe', total: medicao.total, anterior: orcamento.total },
    {
      rotulo: 'Converteu', icone: Handshake, dono: 'equipe', total: converteu.total,
      anterior: medicao.total || orcamento.total,
      partes: [
        { rotulo: 'lançados no Fechamento', valor: converteu.noFechamento, cor: 'bg-emerald-500' },
        { rotulo: 'falta lançar', valor: converteu.soMarcado, cor: 'bg-amber-500', destaque: true },
      ],
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Funil do atendimento</p>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground [text-wrap:balance]">
            {conversas === 0
              ? 'Nenhuma conversa no período'
              : <>{converteu.total} de {conversas} conversa{conversas !== 1 ? 's' : ''} viraram venda</>}
          </h2>
        </div>
        {conversas > 0 && (
          <span className="font-display text-2xl font-bold tabular-nums text-primary">
            {pct(converteu.total, conversas)}%
          </span>
        )}
      </div>

      {conversas > 0 && (
        // No celular a persiana ocupa a largura toda e os textos descem pra baixo dela (order),
        // cada um com o quadradinho da cor da sua lâmina. Lado a lado, o texto ficava mais
        // alto que a lâmina e abria buraco no funil.
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* bandô: o trilho de cima da persiana */}
          <div className="mb-1.5 h-2 rounded-full bg-foreground/80 shadow-sm" aria-hidden="true" />
          <div className="hidden sm:block" />

          {etapas.map((e, i) => {
            const topo = i * RECUO
            const base = (i + 1) * RECUO
            const meio = (topo + base) / 2
            const Icone = e.icone
            const d = DONO[e.dono]
            return (
              <div key={e.rotulo} className="contents">
                {/* a lâmina */}
                <div className="relative h-[72px] py-[3px] sm:h-[84px]">
                  <div
                    className={cn(
                      'flex h-full flex-col items-center justify-center gap-0.5',
                      'animate-in fade-in-0 slide-in-from-top-2 fill-mode-both duration-300 motion-reduce:animate-none',
                      LAMINA[i],
                    )}
                    style={{
                      clipPath: `polygon(${topo}% 0, ${100 - topo}% 0, ${100 - base}% 100%, ${base}% 100%)`,
                      // brilho de cima: luz passando pelo tecido
                      backgroundImage: 'linear-gradient(180deg, hsl(0 0% 100% / 0.16), hsl(0 0% 100% / 0) 60%)',
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-90">
                      <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                      {e.rotulo}
                    </span>
                    <span className="font-display text-2xl font-bold leading-none tabular-nums sm:text-[28px]">{e.total}</span>
                  </div>
                  {/* a linha que liga a lâmina ao texto */}
                  <div aria-hidden="true"
                    className="absolute top-1/2 hidden h-px border-t border-dashed border-foreground/25 sm:block"
                    style={{ left: `calc(${100 - meio}% + 6px)`, right: 0 }} />
                </div>

                {/* o que a etapa quer dizer */}
                <div className="flex min-w-0 items-center gap-3 max-sm:order-1 max-sm:mt-3">
                  <span className="hidden h-2 w-2 shrink-0 rounded-full bg-foreground/40 sm:block" aria-hidden="true" />
                  <div className="min-w-0 py-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm sm:hidden', COR_LAMINA[i])} aria-hidden="true" />
                      <span className="text-sm font-semibold text-foreground">{e.rotulo}</span>
                      <span className={cn('rounded-full border px-1.5 py-px text-[10px] font-semibold', d.cor)}>{d.rotulo}</span>
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground/85">{pct(e.total, conversas)}%</span> das conversas
                      {e.anterior !== null && e.anterior > 0 && <> · {pct(e.total, e.anterior)}% da etapa anterior</>}
                    </p>
                    {e.partes && <Divisao partes={e.partes} />}
                    {e.nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{e.nota}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-5 border-t pt-3 text-[11px] text-muted-foreground">
        Cada lead conta uma vez por etapa: quem foi marcado no WhatsApp e também lançado no Fechamento é um convertido só.
      </p>
    </div>
  )
}
