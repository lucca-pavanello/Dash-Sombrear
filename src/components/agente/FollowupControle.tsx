/**
 * Controle do follow-up automático de leads (admin) — lê/escreve config_automacoes.
 * O workflow "Stella | Follow-up de leads" (n8n) consulta estas chaves a cada rodada:
 * followup_ativo (liga/desliga), followup_teto_dia, followup_dry_run (ensaio: só
 * espelho pro Arthur, sem enviar ao lead).
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircleReply, FlaskConical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Config { chave: string; valor: string }

function Chave({ ligado, onChange, ocupado }: { ligado: boolean; onChange: (v: boolean) => void; ocupado: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={ocupado}
      onClick={() => onChange(!ligado)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-all duration-200 disabled:opacity-50',
        ligado ? 'border-primary bg-primary' : 'border-foreground/20 bg-muted',
      )}
    >
      <span className={cn(
        'absolute top-0 left-0 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
        ligado ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

export default function FollowupControle({ toast }: { toast: (t: 'success' | 'error', m: string) => void }) {
  const qc = useQueryClient()
  const [ocupado, setOcupado] = useState(false)

  const { data: config } = useQuery({
    queryKey: ['config-automacoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_automacoes').select('chave, valor')
      if (error) throw error
      return Object.fromEntries((data as Config[]).map(c => [c.chave, c.valor])) as Record<string, string>
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  async function gravar(chave: string, valor: string) {
    setOcupado(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const { error } = await supabase.from('config_automacoes')
        .update({ valor, atualizado_em: new Date().toISOString(), atualizado_por: sess.session?.user?.email ?? null })
        .eq('chave', chave)
      if (error) throw error
      qc.setQueryData(['config-automacoes'], (prev: Record<string, string> | undefined) =>
        ({ ...(prev ?? {}), [chave]: valor }))
      toast('success', 'Configuração salva.')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Não consegui salvar.')
    } finally {
      setOcupado(false)
    }
  }

  if (!config) return null
  const ativo = config.followup_ativo === '1'
  const ensaio = config.followup_dry_run === '1'
  const teto = config.followup_teto_dia ?? '3'

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2.5">
        <MessageCircleReply className="h-3.5 w-3.5 text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
          Follow-up automático de leads
        </p>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
          !ativo ? 'bg-muted text-muted-foreground'
            : ensaio ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        )}>
          {!ativo ? 'DESLIGADO' : ensaio ? 'ENSAIO' : 'AO VIVO'}
        </span>
      </div>
      <div className="divide-y divide-border/40">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Ligado</p>
            <p className="text-xs text-muted-foreground">A Stella dá um retorno único a leads parados há 48h.</p>
          </div>
          <Chave ligado={ativo} ocupado={ocupado} onChange={v => gravar('followup_ativo', v ? '1' : '0')} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <FlaskConical className="h-3.5 w-3.5 text-amber-500" /> Modo ensaio
            </p>
            <p className="text-xs text-muted-foreground">Gera a mensagem e manda SÓ o espelho pra você — nada chega ao lead.</p>
          </div>
          <Chave ligado={ensaio} ocupado={ocupado} onChange={v => gravar('followup_dry_run', v ? '1' : '0')} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Teto por dia</p>
            <p className="text-xs text-muted-foreground">Máximo de follow-ups enviados num dia (proteção anti-ban).</p>
          </div>
          <input
            type="number" min={1} max={10} inputMode="numeric"
            defaultValue={teto}
            key={teto}
            disabled={ocupado}
            onBlur={e => {
              const v = String(Math.min(10, Math.max(1, parseInt(e.target.value) || 3)))
              if (v !== teto) gravar('followup_teto_dia', v)
            }}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>
    </div>
  )
}
