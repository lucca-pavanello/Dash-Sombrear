import { useMemo, useState } from 'react'
import { Download, RefreshCw, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNumerosEquipe, useOrcamentosChat, type CrmLead } from '@/hooks/useAgenteIA'
import { FALHAS, OBJECOES } from '@/lib/insights/taxonomia'
import { resumirEquipe, tempoLegivel, type FiltroAssunto } from '@/lib/insights/equipe'
import { ehConvertido } from '@/lib/analises/conversao'
import { acharCanal } from '@/components/agente/SeloOrigem'
import { RankingEtiquetas, dataAtividade, linkChatwoot } from '@/components/agente/RankingEtiquetas'
import { variacaoPct } from '@/lib/periodos'
import { exportXlsx } from '@/lib/exportUtils'
import { segmentado } from '@/components/shared/estilos'
import { cn } from '@/lib/utils'

/**
 * Insights do atendimento da EQUIPE (Lucca, 02/10/2026) — o trecho da conversa depois que
 * a equipe assume. Feito pro Matheus, que além do tráfego faz a consultoria de vendas da
 * Sombrear: aqui ele vê o que a equipe pode melhorar.
 *
 * O card entrega o material e a leitura; as ações de treino ficam com ele, por decisão.
 * Por isso a leitura em texto daqui não sugere regra nem treino, ao contrário da da IA.
 *
 * Duas famílias de número, separadas na tela: os DADOS BRUTOS (mensagens e CRM, sem IA)
 * e a LEITURA DA IA (falhas e objeções etiquetadas por classificar-fases, 0029).
 */

const MIN_LIDAS = 3

type Aba = 'falhas' | 'objecoes'
type Leitura = { falhas?: string[]; objecoes?: string[]; preco?: string; numeros?: string }

const ASSUNTOS: [FiltroAssunto, string][] = [['tudo', 'Tudo'], ['venda', 'Venda'], ['pos_venda', 'Pós-venda']]

function Numero({ rotulo, valor, sub }: { rotulo: string; valor: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="font-display text-lg font-bold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function InsightsEquipe({ leads, anteriores, compraram, rotuloDelta, toast }: {
  /** leads do recorte da aba (período + canal), sem o corte de funil */
  leads: CrmLead[]
  anteriores: CrmLead[]
  /** leads com venda no Fechamento (conversao.ts) */
  compraram: Set<string>
  rotuloDelta: string
  toast: (type: 'success' | 'error' | 'info', message: string) => void
}) {
  const { data: numeros, isError: semNumeros } = useNumerosEquipe()
  const { data: orcamentosChat = [] } = useOrcamentosChat()
  const [assunto, setAssunto] = useState<FiltroAssunto>('tudo')
  const [aba, setAba] = useState<Aba>('falhas')
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [gerando, setGerando] = useState(false)

  const r = useMemo(() => resumirEquipe({
    leads, anteriores, assunto,
    numerosPorLead: new Map((numeros?.porLead ?? []).map(n => [n.lead_id, n])),
    respostasPorLead: new Map((numeros?.respostas ?? []).map(n => [n.lead_id, n])),
    orcamentosChat,
    idsConvertidos: new Set(leads.filter(l => ehConvertido(l, compraram)).map(l => l.id)),
  }), [leads, anteriores, assunto, numeros, orcamentosChat, compraram])

  const recorte = assunto === 'tudo' ? r.conversas : r.conversas.filter(l => l.equipe_assunto === assunto)
  const nu = r.numeros
  const linhas = (aba === 'falhas' ? r.falhas : r.objecoes).map(x => ({
    id: x.item.id, rotulo: x.item.rotulo, cor: x.item.cor, dica: x.item.dica,
    n: x.n, pct: x.pct, delta: variacaoPct(x.n, x.anterior),
  }))
  const conversasDe = (id: string) => r.lidas
    .filter(l => ((aba === 'falhas' ? l.equipe_falhas : l.equipe_objecao_tags) ?? []).includes(id))
    .sort((a, b) => new Date(dataAtividade(b)).getTime() - new Date(dataAtividade(a)).getTime())

  async function gerar() {
    if (gerando) return
    setGerando(true)
    try {
      const casos = (lista: typeof r.falhas | typeof r.objecoes, campo: 'equipe_falhas' | 'equipe_objecao_tags') =>
        lista.slice(0, 6).map(x => {
          const exemplos = r.lidas.filter(l => (l[campo] ?? []).includes(x.item.id))
            .map(l => l.equipe_motivo).filter(Boolean).slice(0, 3)
          return `- ${x.item.rotulo}: ${x.n} de ${r.lidas.length} conversas` +
            (exemplos.length ? `\n    casos reais: ${exemplos.join(' / ')}` : '')
        })
      const sens = ['alta', 'media', 'baixa']
        .map(s => `${s}: ${r.lidas.filter(l => l.equipe_sensibilidade_preco === s).length}`).join(', ')

      const prompt = `Você é analista comercial da Sombrear (cortinas e persianas sob medida em Rio Preto).
Abaixo estão CONTAGENS REAIS do atendimento feito pela EQUIPE da loja no WhatsApp, só no trecho
depois que a equipe assumiu a conversa da IA. Não são estimativas.

Recorte: ${assunto === 'tudo' ? 'venda e pós-venda' : assunto === 'venda' ? 'só venda nova' : 'só pós-venda'}.
Base: ${r.lidas.length} conversas lidas.

NÚMEROS (dado bruto, sem IA):
- tempo de resposta da equipe no horário comercial (mediana): ${tempoLegivel(nu.medianaResposta)}
- esperas de mais de 1 hora no horário comercial: ${nu.esperasLongas} de ${nu.respostas} respostas
- mensagens em áudio: ${nu.audios} de ${nu.msgs}
- orçamentos mandados pela equipe: ${nu.orcamentos} de ${recorte.length} conversas
- medições marcadas: ${nu.medicoes} · convertidos: ${nu.convertidos}

FALHAS DE ATENDIMENTO (com casos reais):
${casos(r.falhas, 'equipe_falhas').join('\n') || 'nenhuma falha registrada'}

OBJEÇÕES DOS CLIENTES NO TRECHO DA EQUIPE:
${casos(r.objecoes, 'equipe_objecao_tags').join('\n') || 'nenhuma objeção registrada'}

Sensibilidade a preço — ${sens}.

Responda SOMENTE com JSON válido neste formato:
{"falhas":["..."],"objecoes":["..."],"preco":"...","numeros":"..."}

ESTILO: comece pelo ASSUNTO e ponha o detalhe concreto entre parênteses, com o número real.
Certo:  "Retorno prometido que não veio (cliente cobrando data de instalação, 4 conversas)."
Errado: "A maior incidência foi de retornos esquecidos, totalizando 4 conversas."

- "falhas": até 4 frases nesse estilo, ordenadas pela contagem, explicando como a falha aparece na prática.
- "objecoes": até 3 frases sobre o que trava o cliente quando já está com a equipe.
- "preco": 1 a 2 frases sobre o quanto o preço pesa nessas conversas.
- "numeros": 1 a 2 frases lendo os números brutos juntos (tempo de resposta, esperas, áudio).

Regras: não invente número que não esteja acima. Descreva o que acontece; NÃO proponha ação,
treino nem regra (isso é decidido pelo consultor). Se a base for pequena, diga que é pequena.
Não cite nome de atendente.`

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      })
      if (error) throw new Error(error.message)
      const texto: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const a = texto.indexOf('{'), b = texto.lastIndexOf('}')
      if (a < 0 || b <= a) throw new Error('A IA respondeu fora do formato. Tente de novo.')
      setLeitura(JSON.parse(texto.slice(a, b + 1)) as Leitura)
    } catch (err) {
      console.error('[InsightsEquipe]', err)
      toast('error', err instanceof Error ? err.message : 'Não foi possível gerar a leitura.')
    } finally {
      setGerando(false)
    }
  }

  /** Os dados brutos, uma linha por conversa, pra o Matheus trabalhar na planilha dele. */
  async function baixar() {
    const porLead = new Map((numeros?.porLead ?? []).map(n => [n.lead_id, n]))
    const respostas = new Map((numeros?.respostas ?? []).map(n => [n.lead_id, n]))
    const cotou = new Set(orcamentosChat.filter(o => o.autor === 'equipe').map(o => o.lead_id))
    const rotulos = (ids: string[] | null | undefined, lista: readonly { id: string; rotulo: string }[]) =>
      (ids ?? []).map(id => lista.find(x => x.id === id)?.rotulo ?? id).join('; ')
    const linhasPlanilha = recorte.map(l => {
      const e = porLead.get(l.id)
      const rs = respostas.get(l.id)
      return {
        'Última atividade': new Date(dataAtividade(l)).toLocaleDateString('pt-BR'),
        'Cliente': l.nome || 'sem nome',
        'Canal': acharCanal(l.origem).rotulo,
        'Assunto': l.equipe_assunto === 'pos_venda' ? 'Pós-venda' : l.equipe_assunto === 'venda' ? 'Venda' : 'Ainda não lida',
        'Equipe assumiu em': e?.passagem_em ? new Date(e.passagem_em).toLocaleString('pt-BR') : '',
        'Resposta no horário (mediana, min)': rs?.mediana_min != null ? Math.round(Number(rs.mediana_min)) : '',
        'Esperas de mais de 1h': rs ? Number(rs.esperas_longas) : '',
        'Mensagens da equipe': e ? Number(e.msgs_equipe) : '',
        'Áudios da equipe': e ? Number(e.audios_equipe) : '',
        'Orçamento da equipe': cotou.has(l.id) ? 'sim' : 'não',
        'Medição': l.medicao_equipe ?? '',
        'Converteu': ehConvertido(l, compraram) ? 'sim' : 'não',
        'Falhas (IA)': rotulos(l.equipe_falhas, FALHAS),
        'Objeções (IA)': rotulos(l.equipe_objecao_tags, OBJECOES),
        'Leitura da IA': l.equipe_motivo ?? '',
        'Conversa': linkChatwoot(l) ?? '',
      }
    })
    if (!linhasPlanilha.length) { toast('info', 'Nenhuma conversa da equipe nesse recorte.'); return }
    await exportXlsx(`atendimento-equipe-${new Date().toISOString().slice(0, 10)}.xlsx`, linhasPlanilha)
  }

  return (
    <div>
      {/* de onde vem o número: sem isto, "12 conversas" não se sabe sobre o quê */}
      <p className="mb-4 text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">{r.conversas.length}</span> conversas com a equipe no período
        {' · '}{r.venda} venda · {r.posVenda} pós-venda
        {' · '}<span className="font-semibold tabular-nums text-foreground">{r.lidas.length}</span> lidas pela IA
        {r.naoCliente > 0 && <> · {r.naoCliente} fora por ser fornecedor ou parceiro</>}
        {r.pendentes > 0 && <> · {r.pendentes} esperando leitura (roda sozinha a cada 20 minutos)</>}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className={segmentado.trilho}>
          {ASSUNTOS.map(([id, rotulo]) => (
            <button key={id} onClick={() => setAssunto(id)}
              className={cn(segmentado.item, assunto === id ? segmentado.ativo : segmentado.inativo)}>
              {rotulo}
            </button>
          ))}
        </div>
        <button
          onClick={() => void baixar()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Baixar dados da equipe
        </button>
      </div>

      {/* DADOS BRUTOS: saem das mensagens e do CRM, nada aqui passa pela IA */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Dados brutos</p>
      {semNumeros ? (
        <p className="mb-5 rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Os números da equipe ainda não estão disponíveis (falta a migration 0029 no banco).
        </p>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Numero rotulo="Resposta no horário" valor={tempoLegivel(nu.medianaResposta)} sub="mediana, seg a sex, 8h às 18h" />
          <Numero rotulo="Esperas de +1h" valor={nu.esperasLongas} sub={`de ${nu.respostas} respostas`} />
          <Numero rotulo="Orçamentos" valor={nu.orcamentos} sub={`de ${recorte.length} conversas`} />
          <Numero rotulo="Medições" valor={nu.medicoes} sub="marcadas pela equipe" />
          <Numero rotulo="Convertidos" valor={nu.convertidos} sub={`de ${recorte.length} conversas`} />
          <Numero rotulo="Em áudio" valor={nu.msgs ? `${Math.round((nu.audios / nu.msgs) * 100)}%` : '—'}
            sub={`${nu.audios} de ${nu.msgs} mensagens`} />
        </div>
      )}

      {/* LEITURA DA IA: etiquetas no trecho da equipe */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Leitura da IA</p>
      {r.lidas.length < MIN_LIDAS ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3.5">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Ainda não há conversa da equipe lida suficiente neste recorte
            (<span className="font-semibold text-foreground">{r.lidas.length}</span> de {MIN_LIDAS}).
            A leitura roda sozinha a cada 20 minutos; escolha um período maior se precisar.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className={segmentado.trilho}>
              {([['falhas', 'Falhas de atendimento'], ['objecoes', 'Objeções dos clientes']] as const).map(([id, rotulo]) => (
                <button key={id} onClick={() => setAba(id)}
                  className={cn(segmentado.item, aba === id ? segmentado.ativo : segmentado.inativo)}>
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
              {leitura ? 'Refazer leitura' : 'Ler o período'}
            </button>
          </div>

          {linhas.length === 0 ? (
            <p className="rounded-lg bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground">
              {aba === 'falhas'
                ? `Nenhuma falha marcada nas ${r.lidas.length} conversas lidas.`
                : `Nenhuma objeção registrada nas ${r.lidas.length} conversas lidas.`}
            </p>
          ) : (
            <RankingEtiquetas key={aba} linhas={linhas} conversasDe={conversasDe}
              fraseDe={l => l.equipe_motivo} rotuloDelta={rotuloDelta} />
          )}

          {/* bloco corrido, como a leitura da IA: sem cartão dentro de cartão */}
          {leitura && (
            <div className="mt-4 space-y-5 rounded-lg bg-muted/25 px-5 py-4">
              {([
                ['Onde o atendimento da equipe trava', leitura.falhas],
                ['Objeções que chegam na equipe', leitura.objecoes],
              ] as const).map(([titulo, itens]) =>
                itens?.length ? (
                  <section key={titulo}>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">{titulo}</h3>
                    <ul className="space-y-1.5">
                      {itens.map((t, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/85">
                          <span aria-hidden="true" className="select-none text-muted-foreground/40">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null
              )}
              {([['O que os números dizem', leitura.numeros], ['Sensibilidade a preço', leitura.preco]] as const).map(([titulo, t]) =>
                t ? (
                  <section key={titulo}>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">{titulo}</h3>
                    <p className="text-sm leading-relaxed text-foreground/85">{t}</p>
                  </section>
                ) : null
              )}
              <p className="text-xs text-muted-foreground">
                Leitura da IA sobre as contagens acima. O que fazer a respeito fica com quem acompanha a equipe.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
