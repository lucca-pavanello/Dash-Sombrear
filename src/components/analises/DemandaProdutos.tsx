/**
 * O que pedem × o que fecha.
 *
 * As duas medidas têm unidades diferentes — conversas de um lado, reais do outro. A
 * saída fácil seria um gráfico de dois eixos; a saída honesta é converter as duas em
 * participação no próprio total e deixar as duas dividirem uma escala de 0 a 100%. Dois
 * eixos deixam quem desenha escolher onde as linhas se cruzam, o que é o mesmo que
 * escolher a conclusão.
 *
 * As cores das séries são `--serie-1`/`--serie-2`, validadas para daltonismo e contraste
 * em claro e escuro (ver `src/index.css`). A legenda está sempre presente e cada barra
 * carrega o rótulo direto, então a identidade nunca depende só da cor.
 */
import { PackageSearch } from 'lucide-react'
import type { LinhaDemanda } from '@/lib/analises'
import { formatCurrency, cn } from '@/lib/utils'
import { SecaoAnalise, Cobertura } from './base'

function Barra({ pct, cor, titulo }: { pct: number; cor: string; titulo: string }) {
  return (
    <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted/70" title={titulo}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', cor)}
        style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
      />
    </div>
  )
}

export default function DemandaProdutos({
  linhas, totalConversas, totalReceita,
}: {
  linhas: LinhaDemanda[]
  totalConversas: number
  totalReceita: number
}) {
  const uteis = linhas.filter((l) => l.conversas > 0 || l.receita > 0)

  return (
    <SecaoAnalise
      icone={PackageSearch}
      titulo="O que pedem × o que fecha"
      pergunta="O produto que puxa conversa é o mesmo que gera receita?"
      direita={<Cobertura>{totalConversas} conversas · {formatCurrency(totalReceita)}</Cobertura>}
    >
      {uteis.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground/50">
          Sem produto identificado no período. A família vem da conversa lida pela IA e do
          modelo do pedido.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-3 w-3 rounded-sm bg-serie-2" aria-hidden="true" />
              Procura (conversas)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-3 w-3 rounded-sm bg-serie-1" aria-hidden="true" />
              Receita fechada
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              participação de cada lado no seu próprio total
            </span>
          </div>

          <ul className="space-y-3">
            {uteis.map((l) => (
              <li key={l.id}>
                <div className="flex items-baseline gap-2">
                  <span className={cn('truncate text-sm font-semibold',
                    l.identificado ? 'text-foreground/85' : 'text-muted-foreground')}>
                    {l.rotulo}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {l.conversas} conversa{l.conversas === 1 ? '' : 's'}
                    {l.receita > 0 && ` · ${formatCurrency(l.receita)}`}
                  </span>
                </div>
                {/* gap de 2px entre as duas barras: sem ele as faixas encostam e leem como uma só */}
                <div className="mt-1.5 space-y-[3px]">
                  <div className="flex items-center gap-2">
                    <Barra pct={l.pctDemanda} cor="bg-serie-2" titulo={`${l.pctDemanda.toFixed(0)}% da procura`} />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {l.pctDemanda.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Barra pct={l.pctReceita} cor="bg-serie-1" titulo={`${l.pctReceita.toFixed(0)}% da receita`} />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {l.pctReceita.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            "Não identificado" é conversa em que a IA não reconheceu o produto — não é
            chute, é ausência de dado, e por isso fica no fim da lista.
          </p>
        </>
      )}
    </SecaoAnalise>
  )
}
