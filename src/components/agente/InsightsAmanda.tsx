import { useMemo, useState } from 'react'
import { Sparkles, RefreshCw, Brain, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { OBJECOES } from '@/lib/insights/taxonomia'
import { acharProduto, SEM_PRODUTO } from '@/lib/produtos'
import { intervaloAtual, periodoAnterior, dentroDe, variacaoPct, rotuloAnterior } from '@/lib/periodos'
import { segmentado } from '@/components/shared/estilos'
import { CHATWOOT_BASE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  /** TODOS os leads, não `filtrados` — ver "base própria" abaixo. */
  leads: CrmLead[]
  periodo: string
  customFrom?: string
  customTo?: string
  /** id do canal selecionado nos chips, ou 'todas' */
  origemFiltro: string
  /** normaliza a origem do lead igual ao resto da aba */
  idOrigem: (l: CrmLead) => string
  toast: (type: 'success' | 'error' | 'info', message: string) => void
}

/**
 * Insights da Amanda — o que trava os clientes, contado em vez de descrito.
 *
 * Antes (até 09/2026) este card mandava 40 conversas pro Gemini e mostrava a prosa que
 * voltava. Comparado com o banco depois que a taxonomia entrou, aquele texto errava a
 * ênfase de forma grosseira: listava "custo extra de instalação" como 2ª objeção mais
 * comum (existia em 1 conversa) e dedicava um parágrafo a "sensibilidade a preço"
 * (preco_alto em 1). O maior tema real — manutenção e limpeza, 12 conversas — aparecia
 * por último. Prosa gerada sobre uma amostra de 40 dá exatamente isso: convicção sem
 * contagem. Agora a IA etiqueta cada conversa (src/lib/insights/taxonomia.ts) e aqui só
 * se conta.
 *
 * BASE PRÓPRIA (de propósito): o resto da aba trabalha com `filtrados`, que exclui
 * `isLeadHistorico` (status 'historico' ou 'novo'). Para o funil isso está certo. Para
 * cá, não: medido em 03/09/2026, esse corte descartaria 14 das 39 objeções detectadas
 * (36%) — incluindo 5 dos 12 casos de manutenção — porque `status_lead='Novo'` é um
 * artefato de dado, não sinal de que a conversa não aconteceu. Então este card filtra
 * por período e canal (igual à aba) mas NÃO aplica o corte de funil, e mostra a base que
 * está usando no cabeçalho, pra ninguém precisar adivinhar de onde vem o número.
 */

const MIN_ANALISADAS = 3
/** venda de verdade — fora pós-venda, não-cliente e conversa curta demais pra julgar */
const COMERCIAIS = new Set(['venda', 'negociacao', 'perdida'])

type Aba = 'objecoes' | 'produtos'

/** mesma regra de data da aba: vale a última mensagem, não a criação da linha */
function dataAtividade(l: CrmLead): string {
  const ultima = l.timestamp_ultima_msg ? new Date(l.timestamp_ultima_msg).getTime() : NaN
  const criada = new Date(l.created_at).getTime()
  return Number.isFinite(ultima) && ultima > criada ? (l.timestamp_ultima_msg as string) : l.created_at
}

function linkChatwoot(l: CrmLead): string | null {
  if (!l.id_conta_chatwoot || !l.id_conversa_chatwoot) return null
  return `${CHATWOOT_BASE_URL}/app/accounts/${l.id_conta_chatwoot}/conversations/${l.id_conversa_chatwoot}`
}

function Delta({ pct, rotulo }: { pct: number | null; rotulo: string }) {
  if (pct === null || Math.abs(pct) < 1) return null
  const Icone = pct > 0 ? TrendingUp : TrendingDown
  // subir objeção é ruim, cair é bom — o oposto do delta de faturamento
  const cor = pct > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
  return (
    <span className={cn('flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums', cor)}>
      <Icone className="h-3 w-3" aria-hidden="true" />
      {Math.abs(pct).toFixed(0)}% <span className="font-normal text-muted-foreground">{rotulo}</span>
    </span>
  )
}

export default function InsightsAmanda({
  leads, periodo, customFrom, customTo, origemFiltro, idOrigem, toast,
}: Props) {
  const [analise, setAnalise] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [aba, setAba] = useState<Aba>('objecoes')
  const [aberta, setAberta] = useState<string | null>(null)

  const faixaAtual = useMemo(
    () => intervaloAtual(periodo, customFrom, customTo),
    [periodo, customFrom, customTo]
  )
  const faixaAnterior = useMemo(
    () => periodoAnterior(periodo, customFrom, customTo),
    [periodo, customFrom, customTo]
  )

  const base = useMemo(() => {
    // faixa null = "tudo": sem recorte de data
    const noPeriodo = (l: CrmLead) => faixaAtual === null || dentroDe(dataAtividade(l), faixaAtual)
    const doCanal = (l: CrmLead) => origemFiltro === 'todas' || idOrigem(l) === origemFiltro

    const doRecorte = leads.filter(l => noPeriodo(l) && doCanal(l))
    // fornecedor, costureira parceira, conversa interna, engano: não são cliente e não
    // dizem nada sobre o atendimento. Ficam fora da conta e o cabeçalho diz quantas foram.
    const naoCliente = doRecorte.filter(l => l.classificacao_ia === 'sem_interesse')
    const conversas = doRecorte.filter(l => l.classificacao_ia !== 'sem_interesse')
    // "analisada" = já passou pela taxonomia. Array vazio conta: quer dizer "li e não
    // havia objeção", que é diferente de "nunca li".
    const analisadas = conversas.filter(l => l.objecao_tags != null)

    const anteriores = faixaAnterior
      ? leads.filter(l =>
          dentroDe(dataAtividade(l), faixaAnterior) && doCanal(l) &&
          l.classificacao_ia !== 'sem_interesse' && l.objecao_tags != null)
      : []

    return { conversas, analisadas, naoCliente, anteriores }
  }, [leads, faixaAtual, faixaAnterior, origemFiltro, idOrigem])

  const ranking = useMemo(() => {
    const conta = (arr: CrmLead[]) => {
      const m = new Map<string, number>()
      for (const l of arr) for (const t of l.objecao_tags ?? []) m.set(t, (m.get(t) ?? 0) + 1)
      return m
    }
    const atual = conta(base.analisadas)
    const antes = conta(base.anteriores)
    const denominador = base.analisadas.length || 1

    return OBJECOES
      .map(o => ({
        objecao: o,
        n: atual.get(o.id) ?? 0,
        pct: ((atual.get(o.id) ?? 0) / denominador) * 100,
        delta: variacaoPct(atual.get(o.id) ?? 0, antes.get(o.id) ?? 0),
      }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n)
  }, [base])

  const porProduto = useMemo(() => {
    const m = new Map<string, { n: number; comObjecao: number }>()
    for (const l of base.analisadas) {
      const p = acharProduto(l.produto_familia)
      const at = m.get(p.id) ?? { n: 0, comObjecao: 0 }
      at.n++
      if ((l.objecao_tags ?? []).length) at.comObjecao++
      m.set(p.id, at)
    }
    return [...m.entries()]
      .map(([id, v]) => ({
        id,
        rotulo: id === SEM_PRODUTO.id ? SEM_PRODUTO.rotulo : acharProduto(id).rotulo,
        ...v,
        pct: (v.n / (base.analisadas.length || 1)) * 100,
      }))
      .sort((a, b) => b.n - a.n)
  }, [base])

  /** conversas de uma objeção — o drill-down que deixa conferir se a etiqueta bate */
  const conversasDa = (tag: string) =>
    base.analisadas
      .filter(l => (l.objecao_tags ?? []).includes(tag))
      .sort((a, b) => new Date(dataAtividade(b)).getTime() - new Date(dataAtividade(a)).getTime())

  const comerciais = base.analisadas.filter(l => COMERCIAIS.has(l.classificacao_ia ?? ''))
  const cobertura = base.conversas.length
    ? Math.round((base.analisadas.length / base.conversas.length) * 100)
    : 0

  async function gerar() {
    if (gerando) return
    setGerando(true)
    try {
      // A leitura em prosa agora vai em cima dos NÚMEROS já apurados, não de uma amostra
      // de 40 conversas cruas: o modelo interpreta o que foi contado, em vez de estimar.
      const topo = ranking.slice(0, 6).map(r => `${r.objecao.rotulo}: ${r.n} de ${base.analisadas.length} conversas`)
      const produtos = porProduto.slice(0, 5).map(p => `${p.rotulo}: ${p.n}`)
      const prompt = `Você é analista comercial da Sombrear (cortinas e persianas sob medida em Rio Preto).
Abaixo estão CONTAGENS REAIS já apuradas das conversas de WhatsApp do período. Não são estimativas.

Base: ${base.analisadas.length} conversas analisadas (${comerciais.length} são de venda; o resto é pós-venda ou conversa curta demais para julgar).

Objeções encontradas:
${topo.join('\n') || 'nenhuma objeção registrada no período'}

Produtos citados:
${produtos.join('\n') || 'nenhum produto identificado'}

Escreva em português BR, no máximo 6 linhas, sem título e sem bullet:
- o que esses números dizem sobre o atendimento agora;
- a ÚNICA coisa mais valiosa a mudar, e por quê.
Regras: não invente número que não está acima; não repita a lista; se a base for pequena, diga que é pequena em vez de generalizar.`

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      })
      if (error) throw new Error(error.message)
      const texto: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!texto.trim()) throw new Error('Resposta vazia')
      setAnalise(texto.trim())
    } catch (err) {
      console.error('[InsightsAmanda]', err)
      toast('error', err instanceof Error ? err.message : 'Não foi possível gerar a leitura.')
    } finally {
      setGerando(false)
    }
  }

  const rotuloDelta = rotuloAnterior(periodo)

  return (
    <div className="rounded-xl border-2 bg-card p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Insights da Amanda</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">beta</span>
        <span className="text-xs text-muted-foreground">o que trava os clientes, contado conversa a conversa</span>
      </div>

      {/* Cobertura: de onde vem o número. Sem isto, "12 conversas" não se sabe sobre o quê. */}
      <p className="mb-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{base.conversas.length}</span> conversas no período
        {' · '}
        <span className="font-semibold text-foreground tabular-nums">{base.analisadas.length}</span> analisadas ({cobertura}%)
        {base.naoCliente.length > 0 && <> · {base.naoCliente.length} fora por não ser cliente</>}
        {cobertura < 100 && base.conversas.length > 0 && (
          <> — para analisar o resto, use o painel de classificação acima.</>
        )}
      </p>

      {base.analisadas.length < MIN_ANALISADAS ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3.5">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Ainda não há conversa analisada suficiente neste período
            (<span className="font-semibold text-foreground">{base.analisadas.length}</span> de {MIN_ANALISADAS}).
            Classifique as conversas no painel acima, ou escolha um período maior.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className={segmentado.trilho}>
              {([['objecoes', 'Objeções'], ['produtos', 'Por produto']] as const).map(([id, rotulo]) => (
                <button
                  key={id}
                  onClick={() => { setAba(id); setAberta(null) }}
                  className={cn(segmentado.item, aba === id ? segmentado.ativo : segmentado.inativo)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <button
              onClick={gerar}
              disabled={gerando}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3 w-3', gerando && 'animate-spin')} aria-hidden="true" />
              {analise ? 'Refazer leitura' : 'Ler o período'}
            </button>
          </div>

          {aba === 'objecoes' && (
            ranking.length === 0 ? (
              <p className="rounded-lg bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground">
                Nenhuma objeção registrada nas {base.analisadas.length} conversas analisadas — ninguém
                declarou um motivo para travar. Isso é resultado legítimo, não falta de dado.
              </p>
            ) : (
              <div className="space-y-2.5">
                {ranking.map(({ objecao, n, pct, delta }) => {
                  const aberto = aberta === objecao.id
                  return (
                    <div key={objecao.id}>
                      <button
                        onClick={() => setAberta(aberto ? null : objecao.id)}
                        aria-expanded={aberto}
                        className="w-full rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full border', objecao.cor)} aria-hidden="true" />
                            <span className="truncate text-xs font-medium">{objecao.rotulo}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Delta pct={delta} rotulo={rotuloDelta} />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {n} <span className="text-muted-foreground/50">· {pct.toFixed(0)}%</span>
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full bg-foreground/25 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </button>

                      {aberto && (
                        <div className="mt-2 space-y-1.5 rounded-lg bg-muted/25 px-3 py-2.5">
                          <p className="text-[11px] text-muted-foreground">{objecao.dica}</p>
                          {conversasDa(objecao.id).map(l => {
                            const url = linkChatwoot(l)
                            return (
                              <div key={l.id} className="flex items-start justify-between gap-2 border-t border-border/50 pt-1.5 first:border-0 first:pt-0">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium">{l.nome || 'sem nome'}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {l.classificacao_motivo || 'sem motivo registrado'}
                                  </p>
                                </div>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="text-[11px] tabular-nums text-muted-foreground">
                                    {new Date(dataAtividade(l)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                  {url && (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Abrir a conversa no Chatwoot"
                                      className="text-muted-foreground transition-colors hover:text-primary"
                                    >
                                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                    </a>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {aba === 'produtos' && (
            <div className="space-y-2.5">
              {porProduto.map(p => (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{p.rotulo}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.n} <span className="text-muted-foreground/50">· {p.comObjecao} com objeção</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full bg-foreground/25 transition-all duration-500" style={{ width: `${Math.max(p.pct, 2)}%` }} />
                  </div>
                </div>
              ))}
              {porProduto.some(p => p.id === SEM_PRODUTO.id) && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  “{SEM_PRODUTO.rotulo}” são conversas em que o cliente não disse o modelo —
                  ficam aqui em vez de serem chutadas para um produto qualquer.
                </p>
              )}
            </div>
          )}

          {analise && (
            <div className="mt-4 rounded-lg bg-muted/25 px-4 py-3 text-sm leading-relaxed text-foreground">
              {analise}
            </div>
          )}
        </>
      )}
    </div>
  )
}
