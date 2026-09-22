/**
 * Por que as pessoas não fecham — a seção que justifica a aba existir.
 *
 * Nenhum CRM de prateleira responde isso: a Amanda etiqueta cada conversa com uma
 * taxonomia fechada (`src/lib/insights/taxonomia.ts`) e aqui só se conta. O diferencial
 * sobre o card do Agente IA é a `dica`: as três primeiras objeções trazem a ação
 * recomendada VISÍVEL, não escondida atrás de um accordion. Ranking sem o que fazer a
 * respeito é entretenimento.
 *
 * Forma: lista ranqueada, nunca pizza nem barra empilhada 100%. `objecao_tags` é
 * multi-rótulo — uma conversa pode ter três objeções — então as porcentagens não somam
 * 100 e qualquer forma que prometa "partes de um todo" mentiria. O denominador é
 * "conversas analisadas" e está escrito na tela.
 */
import { useState } from 'react'
import { ShieldAlert, ChevronDown } from 'lucide-react'
import type { LinhaObjecao } from '@/lib/analises'
import { MIN_PARA_PCT } from '@/lib/analises'

import { SecaoAnalise, Cobertura, Delta, BarraProporcao, NumeroAnimado } from './base'

/** Quantas trazem a dica aberta. Mais que três e nenhuma delas se destaca. */
const COM_DICA_ABERTA = 3

export default function ParedeObjecoes({
  linhas, analisadas, naoCliente, rotuloComparacao,
}: {
  linhas: LinhaObjecao[]
  analisadas: number
  naoCliente: number
  rotuloComparacao: string
}) {
  const [aberta, setAberta] = useState<string | null>(null)

  return (
    <SecaoAnalise
      icone={ShieldAlert}
      titulo="O que trava a venda"
      pergunta="Por que o cliente não fecha — e o que dá pra fazer a respeito"
      direita={
        <Cobertura tom={analisadas < MIN_PARA_PCT ? 'atencao' : 'neutro'}>
          {analisadas} conversas lidas
        </Cobertura>
      }
    >
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground/50">
          {analisadas === 0
            ? 'A IA ainda não leu nenhuma conversa deste período. As objeções aparecem depois da leitura.'
            : 'Nenhuma objeção registrada nas conversas lidas deste período.'}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {linhas.map((l, i) => {
              const expandida = aberta === l.objecao.id
              const dicaVisivel = i < COM_DICA_ABERTA || expandida
              return (
                <li key={l.objecao.id}>
                  <div className="flex items-center gap-2">
                    {/* a posição no ranking identifica a linha melhor que uma cor: com
                        onze objeções, onze matizes viram confete e nenhuma se destaca */}
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums text-muted-foreground"
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground/85">
                      {l.objecao.rotulo}
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-foreground">
                      <NumeroAnimado valor={l.n} />
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {l.pct !== null ? `${l.pct.toFixed(0)}%` : `de ${analisadas}`}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3">
                    <BarraProporcao
                      fatia={l.fatia}
                      cor="bg-foreground/50"
                      className="h-3 flex-1"
                      titulo={`${l.n} de ${analisadas} conversas`}
                    />
                    <Delta pct={l.delta} rotulo={rotuloComparacao} bom="cair" />
                  </div>

                  {dicaVisivel ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-foreground/65">
                      {l.objecao.dica}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAberta(l.objecao.id)}
                      className="mt-1 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      o que fazer
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Base: {analisadas} conversas de cliente já lidas pela IA
            {naoCliente > 0 && ` (${naoCliente} fora da conta por não serem cliente — fornecedor, engano, conversa interna)`}.
            Uma conversa pode ter mais de uma objeção, então as porcentagens não somam 100.
            {analisadas < MIN_PARA_PCT && ' Amostra pequena: os números aparecem em contagem, não em porcentagem.'}
          </p>
        </>
      )}
    </SecaoAnalise>
  )
}
