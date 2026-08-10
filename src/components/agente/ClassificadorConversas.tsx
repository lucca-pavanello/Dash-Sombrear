/**
 * Leitura das conversas pela IA — veredito por conversa (venda / negociação /
 * perdida / sem interesse) com o motivo em uma frase, gravado no CRM pela
 * edge function `classificar-conversas`.
 *
 * Aqui ficam as duas peças visuais: o painel de resumo (topo do Agente IA) e
 * o selo que aparece na linha de cada lead.
 */
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Brain, CheckCircle2, Loader2, MessagesSquare, MinusCircle, Sparkles, XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { CrmLead } from '@/hooks/useAgenteIA'

type Resultado = 'venda' | 'negociacao' | 'perdida' | 'sem_interesse' | 'indefinido'

const ESTILO: Record<Resultado, { label: string; classe: string; Icone: typeof CheckCircle2 }> = {
  venda:         { label: 'Virou venda',   classe: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', Icone: CheckCircle2 },
  negociacao:    { label: 'Negociando',    classe: 'bg-primary/12 text-primary border-primary/30',                                    Icone: MessagesSquare },
  perdida:       { label: 'Perdida',       classe: 'bg-destructive/10 text-destructive border-destructive/30',                        Icone: XCircle },
  sem_interesse: { label: 'Sem interesse', classe: 'bg-muted text-muted-foreground border-border',                                     Icone: MinusCircle },
  indefinido:    { label: 'Indefinido',    classe: 'bg-muted text-muted-foreground border-border',                                     Icone: MinusCircle },
}

const ORDEM: Resultado[] = ['venda', 'negociacao', 'perdida', 'sem_interesse', 'indefinido']

/** Selo compacto pra linha do lead. */
export function SeloClassificacao({ lead, className }: { lead: CrmLead; className?: string }) {
  const r = (lead.classificacao_ia ?? '') as Resultado
  if (!ESTILO[r]) return null
  const { label, classe, Icone } = ESTILO[r]
  return (
    <span
      title={lead.classificacao_motivo ? `IA: ${lead.classificacao_motivo}` : 'Classificado pela IA'}
      className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap', classe, className)}
    >
      <Icone className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  )
}

interface Props {
  leads: CrmLead[]
  toast: (type: 'success' | 'error' | 'info', message: string) => void
}

export default function ClassificadorConversas({ leads, toast }: Props) {
  const qc = useQueryClient()
  const [rodando, setRodando] = useState(false)

  const { contagem, classificadas, pendentes, motivosPerdidas, nHistoricas } = useMemo(() => {
    const comConversa = leads.filter(l => (l.resumo_conversa ?? '').trim().length >= 20)
    const nHistoricas = comConversa.filter(l => (l.status_lead ?? '').toLowerCase().trim() === 'historico').length
    const classificadas = comConversa.filter(l => !!l.classificacao_ia)
    const contagem = ORDEM.map(r => ({ r, n: classificadas.filter(l => l.classificacao_ia === r).length }))
      .filter(x => x.n > 0)
    const motivosPerdidas = classificadas
      .filter(l => l.classificacao_ia === 'perdida' && l.classificacao_motivo)
      .slice(0, 3)
      .map(l => ({ nome: l.nome ?? 'Lead', motivo: l.classificacao_motivo as string }))
    return { contagem, classificadas, pendentes: comConversa.length - classificadas.length, motivosPerdidas, nHistoricas }
  }, [leads])

  async function analisar() {
    if (rodando) return
    setRodando(true)
    try {
      const { data, error } = await supabase.functions.invoke('classificar-conversas', { body: {} })
      if (error) throw new Error(error.message)
      const r = data as { classificadas?: number; restantes?: number; mensagem?: string; error?: string }
      if (r.error) throw new Error(r.error)
      await qc.invalidateQueries({ queryKey: ['crm-leads'] })
      if (r.classificadas) {
        toast('success', `${r.classificadas} conversa${r.classificadas > 1 ? 's' : ''} analisada${r.classificadas > 1 ? 's' : ''}` +
          (r.restantes ? ` · ainda faltam ${r.restantes}` : ''))
      } else {
        toast('info', r.mensagem ?? 'Nada novo pra analisar.')
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Não consegui analisar agora.')
    } finally {
      setRodando(false)
    }
  }

  const total = classificadas.length + pendentes
  if (total === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2.5">
        <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
          Leitura das conversas pela IA
        </p>
        <span className="text-[11px] text-muted-foreground">
          {classificadas.length} de {total} analisada{total > 1 ? 's' : ''}
          {nHistoricas > 0 && <> · inclui {nHistoricas} do histórico da loja</>}
        </span>
        <button
          type="button"
          onClick={analisar}
          disabled={rodando}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {rodando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {rodando ? 'Analisando…' : pendentes > 0 ? `Analisar ${pendentes} conversa${pendentes > 1 ? 's' : ''}` : 'Reanalisar'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {classificadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A IA lê cada conversa e diz se virou venda, está em negociação ou foi perdida — e o motivo.
            Clique em <strong>Analisar</strong> pra rodar sobre as conversas já registradas.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {contagem.map(({ r, n }) => {
                const { label, classe, Icone } = ESTILO[r]
                return (
                  <span key={r} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold', classe)}>
                    <Icone className="h-3.5 w-3.5 shrink-0" />
                    {n} {label.toLowerCase()}
                  </span>
                )
              })}
            </div>

            {motivosPerdidas.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Por que perdemos (nas palavras da IA)
                </p>
                <ul className="space-y-1">
                  {motivosPerdidas.map((m, i) => (
                    <li key={i} className="text-xs text-foreground/70">
                      <span className="font-semibold text-foreground">{m.nome}:</span> {m.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
