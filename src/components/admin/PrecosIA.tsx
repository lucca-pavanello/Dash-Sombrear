import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, History, Loader2, Send, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Props { toast: (type: 'success' | 'error', message: string) => void }

interface Acao { tipo: string; [k: string]: unknown }
interface Mensagem { papel: 'user' | 'ia'; texto: string; acoes?: Acao[]; aplicado?: boolean }
interface Auditoria { id: number; usuario: string; acao: string; detalhe: Record<string, unknown>; criado_em: string }

function descreverAcao(a: Acao): string {
  switch (a.tipo) {
    case 'criar_promocao':
      return `Promoção: ${a.tecido} com −${a.desconto_pct}% de ${a.inicio} até ${a.fim}`
    case 'remover_promocao':
      return `Remover promoção #${a.id}`
    case 'atualizar_preco_tecido':
      return `Preço do tecido ${a.nome}${a.largura != null ? ` (largura ${a.largura}m)` : ' (todas as larguras)'} → R$ ${Number(a.preco).toFixed(2)}`
    case 'atualizar_parametro':
      return `Parâmetro ${a.chave} → ${a.valor}`
    case 'atualizar_preco_artigo':
      return `Artigo ${a.nome} (${a.categoria}) → R$ ${Number(a.preco).toFixed(2)}`
    default:
      return JSON.stringify(a)
  }
}

export default function PrecosIA({ toast }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([{
    papel: 'ia',
    texto: 'Oi! Me diz o que você quer mudar nos preços — por exemplo: "coloca o SCREEN 3% BEGE com 10% de desconto até o fim do mês" ou "o BK BRANCO sobe pra R$ 36". Eu preparo a mudança e você só confirma.',
  }])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: auditoria } = useQuery<Auditoria[]>({
    queryKey: ['precos', 'auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_auditoria').select('*').order('criado_em', { ascending: false }).limit(10)
      if (error) throw error
      return data as Auditoria[]
    },
  })

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, pensando])

  async function enviar() {
    const msg = texto.trim()
    if (!msg || pensando) return
    setTexto('')
    setMensagens(m => [...m, { papel: 'user', texto: msg }])
    setPensando(true)
    try {
      const historico = mensagens.slice(-6).map(m => ({ papel: m.papel, texto: m.texto }))
      const { data, error } = await supabase.functions.invoke('precos-ia', {
        body: { modo: 'propor', mensagem: msg, historico },
      })
      if (error) throw error
      setMensagens(m => [...m, { papel: 'ia', texto: data.resposta || 'Certo!', acoes: data.acoes?.length ? data.acoes : undefined }])
    } catch {
      toast('error', 'A IA não respondeu — tenta de novo')
      setMensagens(m => [...m, { papel: 'ia', texto: 'Tive um problema aqui — pode repetir?' }])
    } finally {
      setPensando(false)
    }
  }

  async function aplicar(indice: number, acoes: Acao[]) {
    setAplicando(true)
    try {
      const { data, error } = await supabase.functions.invoke('precos-ia', {
        body: { modo: 'aplicar', acoes },
      })
      if (error || !data?.ok) throw new Error()
      setMensagens(m => m.map((msg, i) => i === indice ? { ...msg, aplicado: true } : msg))
      setMensagens(m => [...m, { papel: 'ia', texto: `Aplicado! ✅\n${(data.aplicadas as string[]).join('\n')}\nA planilha-espelho já está sincronizando.` }])
      queryClient.invalidateQueries({ queryKey: ['precos'] })
      toast('success', `${acoes.length} mudança${acoes.length > 1 ? 's' : ''} aplicada${acoes.length > 1 ? 's' : ''}!`)
    } catch {
      toast('error', 'Erro ao aplicar — confira o histórico ao lado para ver o que entrou')
    } finally {
      setAplicando(false)
    }
  }

  function descartar(indice: number) {
    setMensagens(m => m.map((msg, i) => i === indice ? { ...msg, aplicado: false, acoes: undefined } : msg))
    setMensagens(m => [...m, { papel: 'ia', texto: 'Beleza, descartei. Me diz como prefere então!' }])
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Chat */}
      <div className="lg:col-span-2 rounded-xl border-2 bg-card shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center gap-2.5 border-b px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="font-display text-sm font-semibold tracking-wide">Assistente de Preços</h2>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            propõe → você confirma
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: 420, minHeight: 280 }}>
          {mensagens.map((m, i) => (
            <div key={i} className={cn('flex', m.papel === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap',
                m.papel === 'user' ? 'bg-brand-gradient text-white shadow-brand' : 'bg-muted text-foreground',
              )}>
                {m.texto}
                {m.acoes && (
                  <div className="mt-2.5 space-y-1.5 rounded-xl border-2 border-primary/25 bg-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Mudanças propostas</p>
                    {m.acoes.map((a, j) => (
                      <p key={j} className="text-xs font-medium">• {descreverAcao(a)}</p>
                    ))}
                    {m.aplicado === undefined ? (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => aplicar(i, m.acoes!)} disabled={aplicando}
                          className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 disabled:opacity-50">
                          {aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Aplicar
                        </button>
                        <button onClick={() => descartar(i)} disabled={aplicando}
                          className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95">
                          <X className="h-3.5 w-3.5" /> Descartar
                        </button>
                      </div>
                    ) : (
                      <p className={cn('mt-1 text-xs font-bold', m.aplicado ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {m.aplicado ? '✓ Aplicado' : 'Descartado'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        <div className="flex gap-2 border-t px-4 py-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder='Ex.: "BK Branco com 15% até dia 20"'
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button onClick={enviar} disabled={pensando || !texto.trim()}
            className="flex items-center justify-center rounded-xl bg-brand-gradient px-4 text-white shadow-brand hover:opacity-90 active:scale-95 disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="font-display text-sm font-semibold tracking-wide">Últimas alterações</h2>
        </div>
        <div className="divide-y">
          {(auditoria ?? []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma alteração pela IA ainda.</p>
          )}
          {(auditoria ?? []).map(a => (
            <div key={a.id} className="px-5 py-3">
              <p className="text-xs font-medium text-foreground">{descreverAcao({ tipo: a.acao, ...a.detalhe })}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {a.usuario} · {new Date(a.criado_em).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
