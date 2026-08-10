import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eraser, History, Loader2, Send, Sparkles, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { usePrecosMutations } from '@/hooks/usePrecos'

interface Props {
  toast: (type: 'success' | 'error', message: string, opts?: { duration?: number }) => void
}

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
    case 'atualizar_componente_ferragem': {
      const antes = a.antes as { item?: string; familia?: string; cor?: string } | undefined
      const nome = antes?.item ?? a.item ?? `componente #${a.id}`
      const fam = antes?.familia ? ` (${[antes.familia, antes.cor].filter(Boolean).join(' ')})` : ''
      return `Ferragem: ${nome}${fam} → R$ ${Number(a.valor).toFixed(2)}`
    }
    case 'atualizar_ph50':
      return `PH 50 ${a.modelo} ${a.cor}: ${a.campo} → R$ ${Number(a.valor).toFixed(2)}`
    case 'atualizar_bando_param':
      return `Bandô ${a.cor}: ${a.campo} → R$ ${Number(a.valor).toFixed(2)}`
    case 'atualizar_colocacao': {
      const antes = a.antes as { ml_min?: number; ml_max?: number } | undefined
      const faixa = antes ? ` (${antes.ml_min}–${antes.ml_max}ml)` : ` #${a.id}`
      return `Instalação${faixa} → R$ ${Number(a.preco).toFixed(2)}`
    }
    case 'atualizar_barra_faixa':
      return `Barra: a partir de ${a.largura_min}m → ${a.qtd_presilhas} presilhas`
    case 'atualizar_motor_componente':
      return `Motor: ${a.item} → R$ ${Number(a.custo).toFixed(2)}`
    case 'atualizar_motor_estrutura': {
      const antes = a.antes as { largura?: number; alt_faixa?: string } | undefined
      const linha = antes ? ` (${antes.largura}m, ${antes.alt_faixa})` : ` #${a.id}`
      return `Motor estrutura${linha} → R$ ${Number(a.valor).toFixed(2)}`
    }
    case 'atualizar_romana':
      return `Romana ${a.largura}×${a.altura}m → R$ ${Number(a.custo).toFixed(2)}`
    case 'editar_grade': {
      const depois = (a.depois ?? {}) as Record<string, unknown>
      const campos = Object.entries(depois).map(([k, v]) => `${k} → ${v}`).join(', ')
      return `Edição manual (${String(a.tabela ?? '').replace('precos_', '')}): ${campos}`
    }
    case 'excluir_grade':
      return `Exclusão manual (${String(a.tabela ?? '').replace('precos_', '')})`
    default:
      return JSON.stringify(a)
  }
}

const TIPOS_REVERSIVEIS = new Set([
  'editar_grade', 'excluir_grade', 'criar_promocao', 'remover_promocao',
  'atualizar_preco_tecido', 'atualizar_parametro', 'atualizar_preco_artigo',
  'atualizar_componente_ferragem', 'atualizar_ph50', 'atualizar_bando_param',
  'atualizar_colocacao', 'atualizar_barra_faixa', 'atualizar_motor_componente',
  'atualizar_motor_estrutura', 'atualizar_romana',
])

const semId = (row: Record<string, unknown>) => {
  const { id: _id, ...resto } = row
  return resto
}

/** Valor que existia antes da mudança — vem do 'antes' gravado na auditoria. */
function valorAnterior(detalhe: Record<string, unknown>): string | null {
  const antes = detalhe?.antes as Record<string, unknown> | Array<Record<string, unknown>> | undefined
  if (!antes) return null
  const bruto = Array.isArray(antes)
    ? antes.map(x => x.preco ?? x.valor).filter(v => v != null)
    : [antes.valor ?? antes.preco ?? antes.custo ?? antes.qtd_presilhas]
  const nums = bruto.filter(v => v != null && !isNaN(Number(v))).map(v => Number(v))
  if (nums.length === 0) return null
  return [...new Set(nums)].map(n => `R$ ${n.toFixed(2)}`).join(' / ')
}

const CHAVE_CONVERSA = 'sombrear-precos-ia-conversa'
const MAX_GUARDADAS = 15

const SAUDACAO: Mensagem = {
  papel: 'ia',
  texto: 'Oi! Me diz o que você quer mudar nos preços — por exemplo: "coloca o SCREEN 3% BEGE com 10% de desconto até o fim do mês" ou "o BK BRANCO sobe pra R$ 36". Eu preparo a mudança e você só confirma.',
}

/** Conversa guardada no aparelho: ao voltar na aba o admin continua de onde parou. */
function carregarConversa(): Mensagem[] {
  try {
    const bruto = localStorage.getItem(CHAVE_CONVERSA)
    if (!bruto) return [SAUDACAO]
    const salvas = JSON.parse(bruto) as Mensagem[]
    if (!Array.isArray(salvas) || salvas.length === 0) return [SAUDACAO]
    // propostas não sobrevivem ao recarregar: os dados podem ter mudado nesse meio-tempo
    return salvas.map(m => ({ ...m, acoes: undefined }))
  } catch { return [SAUDACAO] }
}

export default function PrecosIA({ toast }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(carregarConversa)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_CONVERSA, JSON.stringify(mensagens.slice(-MAX_GUARDADAS)))
    } catch { /* cota cheia: seguir sem persistir */ }
  }, [mensagens])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [desfazendo, setDesfazendo] = useState<number | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { updateRow, insertRow, deleteRow } = usePrecosMutations()

  async function desfazer(a: Auditoria) {
    const d = a.detalhe
    setDesfazendo(a.id)
    try {
      if (a.acao === 'editar_grade') {
        await updateRow(String(d.tabela), d.match as Record<string, unknown>,
          d.antes as Record<string, unknown>, d.depois as Record<string, unknown>)
      } else if (a.acao === 'excluir_grade') {
        await insertRow(String(d.tabela), semId(d.antes as Record<string, unknown>))
      } else if (a.acao === 'criar_promocao' && d.promo_id != null) {
        await deleteRow('precos_promocoes', { id: d.promo_id })
      } else if (a.acao === 'remover_promocao' && d.antes) {
        await insertRow('precos_promocoes', semId(d.antes as Record<string, unknown>))
      } else if (a.acao === 'atualizar_preco_tecido' && Array.isArray(d.antes)) {
        for (const linha of d.antes as { id: number; preco: number }[]) {
          await updateRow('precos_tecidos', { id: linha.id }, { preco: linha.preco }, { preco: d.preco })
        }
      } else if (a.acao === 'atualizar_parametro' && d.antes) {
        await updateRow('precos_parametros', { chave: d.chave },
          { valor: (d.antes as { valor: number }).valor }, { valor: d.valor })
      } else if (a.acao === 'atualizar_preco_artigo' && d.antes) {
        await updateRow('precos_artigos', { categoria: d.categoria, nome: d.nome },
          { preco: (d.antes as { preco: number }).preco }, { preco: d.preco })
      } else if (a.acao === 'atualizar_componente_ferragem' && d.antes) {
        await updateRow('precos_ferragem_componentes', { id: d.id },
          { valor: (d.antes as { valor: number }).valor }, { valor: d.valor })
      } else if (a.acao === 'atualizar_ph50' && d.antes) {
        const campo = String(d.campo)
        await updateRow('precos_ph50', { modelo: d.modelo, cor: d.cor },
          { [campo]: (d.antes as Record<string, number>)[campo] }, { [campo]: d.valor })
      } else if (a.acao === 'atualizar_bando_param' && d.antes) {
        const campo = String(d.campo)
        await updateRow('precos_bandos_params', { cor: d.cor },
          { [campo]: (d.antes as Record<string, number>)[campo] }, { [campo]: d.valor })
      } else if (a.acao === 'atualizar_colocacao' && d.antes) {
        await updateRow('precos_colocacao', { id: d.id },
          { preco: (d.antes as { preco: number }).preco }, { preco: d.preco })
      } else if (a.acao === 'atualizar_barra_faixa' && d.antes) {
        await updateRow('precos_barra_faixas', { largura_min: d.largura_min },
          { qtd_presilhas: (d.antes as { qtd_presilhas: number }).qtd_presilhas }, { qtd_presilhas: d.qtd_presilhas })
      } else if (a.acao === 'atualizar_motor_componente' && d.antes) {
        await updateRow('precos_motor_componentes', { item: d.item },
          { custo: (d.antes as { custo: number }).custo }, { custo: d.custo })
      } else if (a.acao === 'atualizar_motor_estrutura' && d.antes) {
        await updateRow('precos_motor_estrutura', { id: d.id },
          { valor: (d.antes as { valor: number }).valor }, { valor: d.valor })
      } else if (a.acao === 'atualizar_romana' && d.antes) {
        await updateRow('precos_romana_matriz', { largura: d.largura, altura: d.altura },
          { custo: (d.antes as { custo: number }).custo }, { custo: d.custo })
      } else {
        toast('error', 'Essa alteração não tem dados suficientes para desfazer')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['precos'] })
      toast('success', 'Alteração desfeita!')
    } catch {
      toast('error', 'Não consegui desfazer — confira a tabela')
    } finally {
      setDesfazendo(null)
    }
  }

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
      if (error || !data?.ok) {
        // o motivo real vem no corpo da resposta 4xx — sem isso o admin só via "deu erro"
        let motivo = data?.error as string | undefined
        try {
          const ctx = (error as { context?: Response } | null)?.context
          if (ctx) motivo = (await ctx.json())?.error ?? motivo
        } catch { /* corpo não-JSON: fica no genérico */ }
        throw new Error(motivo || '')
      }
      setMensagens(m => m.map((msg, i) => i === indice ? { ...msg, aplicado: true } : msg))
      setMensagens(m => [...m, { papel: 'ia', texto: `Aplicado! ✅\n${(data.aplicadas as string[]).join('\n')}\nA planilha-espelho já está sincronizando.` }])
      queryClient.invalidateQueries({ queryKey: ['precos'] })
      toast('success', `${acoes.length} mudança${acoes.length > 1 ? 's' : ''} aplicada${acoes.length > 1 ? 's' : ''}!`)
    } catch (err) {
      const motivo = err instanceof Error && err.message ? err.message : null
      toast('error', motivo ?? 'Erro ao aplicar — confira o histórico ao lado para ver o que entrou',
        { duration: 9000 })
      if (motivo) {
        setMensagens(m => [...m, { papel: 'ia', texto: `Não consegui aplicar: ${motivo}` }])
      }
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
          {mensagens.length > 1 && (
            <button
              type="button"
              onClick={() => setMensagens([SAUDACAO])}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Limpar conversa (as alterações continuam no histórico ao lado)"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          )}
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
          <span className="ml-auto text-[10px] text-muted-foreground">o valor anterior fica guardado</span>
        </div>
        <div className="divide-y">
          {(auditoria ?? []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma alteração pela IA ainda.</p>
          )}
          {(auditoria ?? []).map(a => (
            <div key={a.id} className="flex items-start gap-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{descreverAcao({ tipo: a.acao, ...a.detalhe })}</p>
                {valorAnterior(a.detalhe) && (
                  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                    antes: {valorAnterior(a.detalhe)}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {a.usuario} · {new Date(a.criado_em).toLocaleString('pt-BR')}
                </p>
              </div>
              {TIPOS_REVERSIVEIS.has(a.acao) && (
                <button onClick={() => desfazer(a)} disabled={desfazendo != null}
                  title="Desfazer esta alteração"
                  className="mt-0.5 flex shrink-0 items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-50">
                  {desfazendo === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                  Desfazer
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
