import { useMemo, useState } from 'react'
import { Sparkles, RefreshCw, Brain } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CrmLead, OrcamentoIA } from '@/hooks/useAgenteIA'
import { formatCurrency } from '@/lib/utils'

interface Props {
  leads: CrmLead[]
  orcamentosIA: OrcamentoIA[]
  toast: (type: 'success' | 'error' | 'info', message: string) => void
}

const MIN_CONVERSAS = 3

// Síntese das conversas dos leads (padrão "research synthesis"): destila objeções,
// tecidos pedidos e sensibilidade a preço a partir dos resumos gravados pelo n8n.
export default function InsightsStella({ leads, orcamentosIA, toast }: Props) {
  const [analise, setAnalise] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  const conversas = useMemo(
    () => leads.filter((l) => (l.resumo_conversa ?? '').trim().length > 20),
    [leads]
  )

  async function gerar() {
    if (gerando) return
    setGerando(true)
    try {
      const amostra = conversas.slice(0, 40).map((l) => ({
        status: l.status_lead ?? 'sem status',
        modelo: l.modelo_interesse ?? '—',
        tecido: l.tecido_cor ?? '—',
        valor: l.ultimo_valor_cotado ?? '—',
        resumo: (l.resumo_conversa ?? '').slice(0, 300),
      }))
      const totalCotado = orcamentosIA.reduce(
        (s, o) => s + (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0),
        0
      )
      const prompt = `Você é analista comercial da Sombrear (cortinas e persianas). Analise os resumos de conversas do agente de WhatsApp abaixo e produza um relatório curto em português BR com EXATAMENTE estas seções (use títulos em negrito):
*Objeções mais comuns* (bullet points, máx 4)
*Produtos e tecidos mais pedidos* (bullet points, máx 4)
*Sensibilidade a preço* (2-3 frases)
*Oportunidades de melhoria no atendimento* (bullet points, máx 3)

Dados: ${conversas.length} conversas com resumo, ${orcamentosIA.length} orçamentos gerados pela IA (total cotado ${formatCurrency(totalCotado)}).

CONVERSAS:
${JSON.stringify(amostra)}`

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      })
      if (error) throw new Error(error.message)
      const texto: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!texto.trim()) throw new Error('Resposta vazia')
      setAnalise(texto)
    } catch (err) {
      console.error('[InsightsStella]', err)
      toast('error', 'Não foi possível gerar a análise. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="rounded-xl border-2 bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Insights da Stella</h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">beta</span>
        <span className="text-xs text-muted-foreground">síntese das conversas do WhatsApp</span>
        {analise && (
          <button
            onClick={gerar}
            disabled={gerando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${gerando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        )}
      </div>

      {conversas.length < MIN_CONVERSAS ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3.5">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            A análise ativa quando houver pelo menos {MIN_CONVERSAS} conversas com resumo —
            hoje há <span className="font-semibold text-foreground">{conversas.length}</span>.
            Assim que a Stella começar a atender, este painel destila objeções, tecidos mais pedidos
            e sensibilidade a preço automaticamente.
          </p>
        </div>
      ) : analise ? (
        <div className="whitespace-pre-line rounded-lg bg-muted/30 px-4 py-3.5 text-sm leading-relaxed text-foreground">
          {analise}
        </div>
      ) : (
        <button
          onClick={gerar}
          disabled={gerando}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {gerando ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analisando {conversas.length} conversas…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar análise de {conversas.length} conversas
            </>
          )}
        </button>
      )}
    </div>
  )
}
