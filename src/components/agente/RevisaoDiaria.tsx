/**
 * Agente IA › Revisão diária.
 *
 * O que dá pra melhorar nas conversas da Amanda num dia, com a fala citada e como ela
 * ficaria melhor. Sai sozinha às 21h (cron da 0030) e o admin pode pedir a de um dia.
 *
 * Tom de melhoria, nunca de erro: nada aqui é vermelho, exceto o cliente que ficou sem
 * resposta nenhuma — esse é fato, não leitura. Os números vêm do código; o texto, do
 * modelo. A tela deixa isso explícito no rodapé de cada revisão.
 *
 * Desenho copiado da Revisão diária do Garimpo, que é o ritual que o Lucca já faz todo
 * dia: um dia por vez, navegação por dias, resumo em cima e a lista de melhorias embaixo.
 */
import { useMemo, useState } from 'react'
import { Brain, ChevronLeft, ChevronRight, ExternalLink, Lightbulb, Loader2, Sparkles } from 'lucide-react'
import { CHATWOOT_BASE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/useProfile'
import { useRevisoes, usePedirRevisao, ROTULO_GRAVIDADE, type RevisaoIA, type ResultadoRevisao } from '@/hooks/useRevisaoIA'
import AvisoErro from '@/components/shared/AvisoErro'
import EmptyState from '@/components/shared/EmptyState'

const CARTAO = 'rounded-xl border border-border bg-card shadow-sm'
const EYEBROW = 'text-[11px] font-bold uppercase tracking-wider text-foreground/50'
const CITACAO = 'rounded-lg bg-muted/30 px-3 py-2 text-[13px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]'

const GRAVIDADE_CLASSE = {
  alta: 'border-primary/40 bg-primary/10 text-primary',
  media: 'border-border bg-muted/40 text-foreground/80',
  baixa: 'border-border text-muted-foreground',
} as const

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** 'AAAA-MM-DD' lido como data da casa — `new Date('...')` leria em UTC e voltaria um dia */
function rotuloDia(dia: string, curto = false): string {
  const [a, m, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  const dm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return curto ? dm : `${SEMANA[data.getUTCDay()]}, ${dm}`
}

function hojeNaCasa(): string {
  const d = new Date(Date.now() - 3 * 3600_000)
  return d.toISOString().slice(0, 10)
}

function linkConversa(id: number): string {
  return `${CHATWOOT_BASE_URL}/app/accounts/1/conversations/${id}`
}

function LinkDaConversa({ r, conversa }: { r: ResultadoRevisao; conversa: string }) {
  const item = r.amostra.find(a => a.conversa === conversa)
  if (!item) return null
  return (
    <>
      <span className="min-w-0 break-words text-[12px] text-muted-foreground">{item.nome ?? conversa}</span>
      <a href={linkConversa(item.conversa_id)} target="_blank" rel="noreferrer noopener"
        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm text-[12px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        abrir conversa <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </>
  )
}

function Pronta({ r, origem }: { r: ResultadoRevisao; origem: 'diaria' | 'manual' }) {
  return (
    <div className="space-y-4">
      <div className={cn(CARTAO, 'px-5 py-4')}>
        <p className={EYEBROW}>
          Revisão de {rotuloDia(r.dia)} · {r.conversas} conversa{r.conversas === 1 ? '' : 's'} da Amanda
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">{r.analise.resumo}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {origem === 'diaria' ? 'Revisão automática das 21h.' : 'Revisão pedida aqui no dash.'}
          {' '}As contagens saem das mensagens gravadas; a leitura é escrita pela IA em cima delas.
        </p>
      </div>

      {r.sem_resposta.length > 0 && (
        <div className={CARTAO}>
          <div className="border-b border-border/60 px-5 py-3">
            <p className={EYEBROW}>Sem resposta da Amanda · {r.sem_resposta.length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              O cliente escreveu enquanto a conversa era da IA e ela ficou calada. Depois que alguém da
              equipe entra, o silêncio dela é o combinado e não entra aqui.
            </p>
          </div>
          <ul className="divide-y divide-border/50">
            {r.sem_resposta.map((s, i) => (
              <li key={i} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold tabular-nums">{s.hora.replace(':', 'h')}</span>
                  <span className={cn('text-[12px]', s.respondeu ? 'text-muted-foreground' : 'font-semibold text-destructive')}>
                    {s.respondeu ? `a equipe respondeu ${s.espera_min} min depois` : 'ninguém respondeu'}
                  </span>
                  <LinkDaConversa r={r} conversa={s.conversa} />
                </div>
                <p className="mt-1 break-words text-sm leading-relaxed text-foreground/90">“{s.texto}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={CARTAO}>
        <div className="border-b border-border/60 px-5 py-3">
          <p className={EYEBROW}>
            O que dá pra melhorar{r.analise.melhorias.length > 0 && ` · ${r.analise.melhorias.length}`}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">Do que mais ajuda a vender para o detalhe.</p>
        </div>
        {r.analise.melhorias.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            Nenhuma melhoria apontada neste dia. É raro — se repetir, vale conferir se a Amanda
            está mesmo atendendo ou se as conversas estão indo direto para a equipe.
          </p>
        ) : (
          <ol className="divide-y divide-border/50">
            {r.analise.melhorias.map((m, i) => (
              <li key={i} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', GRAVIDADE_CLASSE[m.gravidade])}>
                    {ROTULO_GRAVIDADE[m.gravidade]}
                  </span>
                  <LinkDaConversa r={r} conversa={m.conversa} />
                </div>
                <h3 className="mt-1.5 text-[15px] font-medium leading-snug">{m.o_que_aconteceu}</h3>
                {(m.trecho || m.como_fica_melhor) && (
                  <div className="mt-2 grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:items-start lg:gap-4">
                    {m.trecho && <p className={CITACAO}>“{m.trecho}”</p>}
                    {m.como_fica_melhor && (
                      <p className={cn('text-sm leading-relaxed text-foreground/90', m.trecho ? 'lg:py-2' : 'lg:col-span-2')}>
                        <span className="font-semibold">Como fica melhor: </span>{m.como_fica_melhor}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

export default function RevisaoDiaria() {
  const { data: revisoes = [], isPending, isError, refetch } = useRevisoes()
  const { data: perfil } = useProfile()
  const ehAdmin = perfil?.is_admin === true
  const { mutate: pedir, isPending: pedindo, error: erroPedido } = usePedirRevisao()
  const [escolhida, setEscolhida] = useState<string | null>(null)

  // uma por dia: a mais recente de cada dia é a que vale (um "tentar de novo" cria linha nova)
  const porDia = useMemo(() => {
    const vistos = new Set<string>()
    return revisoes.filter(r => (vistos.has(r.dia) ? false : (vistos.add(r.dia), true)))
      .sort((a, b) => a.dia.localeCompare(b.dia))
  }, [revisoes])

  const atual: RevisaoIA | undefined =
    porDia.find(r => r.id === escolhida) ?? porDia[porDia.length - 1]
  const pos = atual ? porDia.findIndex(r => r.id === atual.id) : -1
  const temHoje = porDia.some(r => r.dia === hojeNaCasa())

  const botao = ehAdmin && (
    <button type="button" onClick={() => pedir(undefined)} disabled={pedindo}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60">
      {pedindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {temHoje ? 'Refazer a de hoje' : 'Revisar hoje'}
    </button>
  )

  if (isPending) {
    return <div className={cn(CARTAO, 'h-64 animate-pulse')} aria-label="Carregando a revisão" />
  }
  if (isError) {
    return <AvisoErro mensagem="Não consegui ler as revisões agora." aoTentar={() => void refetch()} className="py-8" />
  }
  if (!atual) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{botao}</div>
        <EmptyState icon={Lightbulb} title="Nenhuma revisão ainda"
          description="A primeira sai hoje às 21h, com o que dá pra melhorar nas conversas da Amanda. Ou clique em Revisar hoje." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Brain className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className={EYEBROW}>Revisão diária</p>
        <div className="ml-auto flex items-center gap-2">
          {porDia.length > 1 && (
            <nav aria-label="Dia da revisão" className="flex items-center gap-1">
              <button type="button" aria-label="Dia anterior" disabled={pos <= 0}
                onClick={() => setEscolhida(porDia[pos - 1]?.id ?? null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums">
                {rotuloDia(atual.dia, true)}
              </span>
              <button type="button" aria-label="Próximo dia" disabled={pos >= porDia.length - 1}
                onClick={() => setEscolhida(porDia[pos + 1]?.id ?? null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary disabled:opacity-40">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
          {botao}
        </div>
      </div>

      {erroPedido && (
        <p className="text-xs text-destructive">{erroPedido.message}</p>
      )}

      {atual.status === 'rodando' ? (
        <div className={cn(CARTAO, 'flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground')}>
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Lendo as conversas de {rotuloDia(atual.dia, true)}… leva de 1 a 3 minutos.
        </div>
      ) : atual.status === 'erro' || !atual.resultado ? (
        <AvisoErro className="py-8"
          mensagem={atual.erro ?? 'A revisão deste dia não ficou pronta.'}
          aoTentar={ehAdmin ? () => pedir(atual.dia) : undefined} />
      ) : (
        <Pronta r={atual.resultado} origem={atual.origem} />
      )}
    </div>
  )
}
