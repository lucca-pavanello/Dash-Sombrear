/**
 * Acompanhar — a fila dos orçamentos que ainda não têm resposta.
 *
 * Esta é a tela que faltava pro dash contar a verdade. Todo o resto mede
 * orçamento gerado; aqui se registra o que aconteceu depois, em um toque:
 * Fechou, Não fechou ou Sumiu. Só "Fechou" pede mais alguma coisa (canal e
 * pagamento), porque é o único que vira dinheiro no Semanário.
 *
 * Regra de ouro da tela: marcar tem que ser mais rápido do que ignorar.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  CheckCircle2, ChevronRight, Clock, MessageCircle, Search, ThumbsDown, Undo2, UserX, Wallet, X,
} from 'lucide-react'

import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { supabase, type Orcamento } from '@/lib/supabase'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { Button, EmptyState } from '@/components/ui/primitives'
import { CustomSelect } from '@/components/ui/CustomSelect'
import SeloOrigem, { ORIGENS } from '@/components/agente/SeloOrigem'
import JanelaDados from '@/components/orcamentos/JanelaDados'
import { DESFECHOS, MOTIVOS_PERDA, diasDesde, faixaEspera, type Desfecho } from '@/lib/desfecho'

const receita = (o: Orcamento) => Number(o.valor_venda ?? 0) + Number(o.instalacao ?? 0)

const FAIXAS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'novo', rotulo: 'Até 7 dias' },
  { id: 'atencao', rotulo: '8 a 30 dias' },
  { id: 'frio', rotulo: '+ de 30 dias' },
] as const

const CANAIS = [
  { value: '', label: 'Não sei de onde veio' },
  ...ORIGENS.map((o) => ({ value: o.id, label: o.rotulo })),
]

const soDigitos = (t: string) => t.replace(/\D/g, '')

export default function TabAcompanhar() {
  const { data: todos = [], isLoading, refetch } = useOrcamentos()

  const [faixa, setFaixa] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [verRespondidos, setVerRespondidos] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [modo, setModo] = useState<'fechou' | 'perdido' | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // rascunho do painel "Fechou"
  const [canal, setCanal] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [cobrado, setCobrado] = useState('')

  const aguardando = useMemo(
    () => todos
      .filter((o) => !o.desfecho && !o.fechado)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [todos])

  const respondidos = useMemo(
    () => todos
      .filter((o) => !!o.desfecho)
      .sort((a, b) => new Date(b.desfecho_em ?? b.created_at).getTime() - new Date(a.desfecho_em ?? a.created_at).getTime()),
    [todos])

  const lista = useMemo(() => {
    const base = verRespondidos ? respondidos : aguardando
    const termo = busca.trim().toLowerCase()
    return base.filter((o) => {
      if (!verRespondidos && faixa !== 'todos' && faixaEspera(diasDesde(o.created_at)).id !== faixa) return false
      if (termo && !`${o.cliente ?? ''} ${o.modelo ?? ''} ${o.tecido ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [verRespondidos, respondidos, aguardando, faixa, busca])

  const resumo = useMemo(() => ({
    fila: aguardando.length,
    parado: aguardando.reduce((s, o) => s + receita(o), 0),
    frios: aguardando.filter((o) => diasDesde(o.created_at) > 30).length,
  }), [aguardando])

  function abrir(o: Orcamento, novoModo: 'fechou' | 'perdido') {
    setErro(null)
    if (abertoId === o.id && modo === novoModo) { setAbertoId(null); setModo(null); return }
    setAbertoId(o.id)
    setModo(novoModo)
    setCanal(o.origem ?? '')
    setParcelas('')
    setCobrado('')
  }

  async function marcar(o: Orcamento, desfecho: Desfecho, extra: Partial<Orcamento> = {}) {
    setSalvando(o.id)
    setErro(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const { error } = await supabase.from('orcamentos').update({
        desfecho,
        desfecho_em: new Date().toISOString(),
        desfecho_por: sess.session?.user?.email ?? null,
        ...extra,
      }).eq('id', o.id)
      if (error) throw error
      setAbertoId(null)
      setModo(null)
      await refetch()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar. Tente de novo.')
    } finally {
      setSalvando(null)
    }
  }

  /** Fechou: vira venda de verdade — liga `fechado`, que é o que o Semanário soma. */
  async function confirmarFechou(o: Orcamento) {
    const num = (s: string) => {
      const v = parseFloat(s.replace(',', '.'))
      return Number.isFinite(v) && v > 0 ? v : null
    }
    const n = Math.round(num(parcelas) ?? 0)
    const valor = num(cobrado)
    const efetivo = valor ?? receita(o)
    let forma: string | null = null
    if (n >= 2 && efetivo > 0) {
      const base = receita(o)
      const juros = base > 0 && efetivo > base + 0.009
        ? ` · +${(((efetivo - base) / base) * 100).toFixed(1)}% de juros`
        : ''
      forma = `${n}x de ${formatCurrency(efetivo / n)}${juros}`
    } else if (n === 1) {
      forma = 'à vista'
    }
    await marcar(o, 'fechou', {
      fechado: true,
      status: 'fechado',
      origem: canal || o.origem || null,
      ...(valor != null ? { valor_cobrado: valor } : {}),
      ...(forma ? { forma_pagamento_real: forma } : {}),
    })
  }

  async function devolverPraFila(o: Orcamento) {
    setSalvando(o.id)
    setErro(null)
    try {
      const { error } = await supabase.from('orcamentos').update({
        desfecho: null,
        desfecho_em: null,
        desfecho_por: null,
        desfecho_motivo: null,
        ...(o.desfecho === 'fechou' ? { fechado: false, status: 'em andamento' } : {}),
      }).eq('id', o.id)
      if (error) throw error
      await refetch()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui desfazer.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" aria-hidden="true" />
          <span className="text-xs font-medium text-primary">Acompanhar</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Acompanhar</h2>
          <p className="mt-0.5 text-sm text-foreground/50">
            O que aconteceu depois do orçamento. Um toque por cliente: fechou, não fechou ou sumiu.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Resumo icone={<Clock className="h-4 w-4" />} rotulo="Esperando resposta" valor={String(resumo.fila)} />
        <Resumo icone={<Wallet className="h-4 w-4" />} rotulo="Valor parado" valor={formatCurrency(resumo.parado)} />
        <Resumo icone={<UserX className="h-4 w-4" />} rotulo="Há mais de 30 dias" valor={String(resumo.frios)}
          alerta={resumo.frios > 0} />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        {!verRespondidos && FAIXAS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFaixa(f.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              faixa === f.id
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/30 hover:text-primary',
            )}
          >
            {f.rotulo}
          </button>
        ))}
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
        <Button variant={verRespondidos ? 'primary' : 'outline'} size="sm"
          onClick={() => { setVerRespondidos((v) => !v); setAbertoId(null) }}>
          {verRespondidos ? 'Ver a fila' : `Já respondidos (${respondidos.length})`}
        </Button>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          titulo={verRespondidos ? 'Nada respondido ainda' : 'Fila vazia — tudo respondido'}
          dica={verRespondidos
            ? 'Marque um orçamento na fila e ele aparece aqui.'
            : 'Cada orçamento novo entra aqui esperando o desfecho.'}
        />
      ) : (
        <div className="space-y-2">
          {lista.map((o) => {
            const dias = diasDesde(o.created_at)
            const f = faixaEspera(dias)
            const d = o.desfecho ? DESFECHOS[o.desfecho as Desfecho] : null
            const aberto = abertoId === o.id
            const ocupado = salvando === o.id
            const tel = soDigitos(o.telefone ?? '')

            return (
              <div key={o.id} className="rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{o.cliente || 'Sem nome'}</span>
                      {o.origem && <SeloOrigem origem={o.origem} compacto />}
                      {d && (
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', d.cor)}>
                          {d.curto}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.modelo}{o.tecido ? ` · ${o.tecido}` : ''}
                      {o.largura && o.altura ? ` · ${o.largura}m × ${o.altura}m` : ''}
                      {o.quantidade > 1 ? ` · ${o.quantidade} peças` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display font-bold tabular-nums text-foreground">{formatCurrency(receita(o))}</p>
                    <p className={cn('text-[11px] font-medium tabular-nums', verRespondidos ? 'text-muted-foreground' : f.cor)}>
                      {verRespondidos
                        ? `respondido em ${formatDate(o.desfecho_em ?? o.created_at)}`
                        : dias === 0 ? 'hoje' : `há ${dias} dia${dias > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {verRespondidos ? (
                    <>
                      {o.desfecho_motivo && (
                        <span className="text-xs text-muted-foreground">Motivo: {o.desfecho_motivo}</span>
                      )}
                      <Button variant="ghost" size="sm" className="ml-auto" loading={ocupado}
                        onClick={() => devolverPraFila(o)}>
                        {!ocupado && <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        Voltar pra fila
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => abrir(o, 'fechou')}
                        className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                        aria-expanded={aberto && modo === 'fechou'}>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Fechou
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => abrir(o, 'perdido')}
                        aria-expanded={aberto && modo === 'perdido'}>
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Não fechou
                      </Button>
                      <Button variant="ghost" size="sm" loading={ocupado && !aberto}
                        onClick={() => marcar(o, 'sumiu')}>
                        {!(ocupado && !aberto) && <UserX className="h-3.5 w-3.5" aria-hidden="true" />} Sumiu
                      </Button>
                      {tel && (
                        <a
                          href={`https://wa.me/55${tel}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Cobrar no WhatsApp
                        </a>
                      )}
                    </>
                  )}
                </div>

                {/* Painel do "Fechou" */}
                {aberto && modo === 'fechou' && (
                  <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-medium text-muted-foreground">
                        De onde veio o cliente?
                        <CustomSelect className="mt-1 w-full py-2" value={canal} onChange={setCanal} options={CANAIS} />
                      </label>
                      <label className="text-xs font-medium text-muted-foreground">
                        Em quantas vezes saiu?
                        <input value={parcelas} onChange={(e) => setParcelas(e.target.value)}
                          inputMode="numeric" placeholder="ex.: 6"
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                      </label>
                      <label className="text-xs font-medium text-muted-foreground">
                        Quanto o cliente pagou?
                        <input value={cobrado} onChange={(e) => setCobrado(e.target.value)}
                          inputMode="decimal" placeholder={formatCurrency(receita(o))}
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                      </label>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Deixe em branco o que não souber — só o canal já ajuda a saber qual anúncio deu venda.
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setAbertoId(null); setModo(null) }}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                      </Button>
                      <Button size="sm" loading={ocupado}
                        className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                        onClick={() => confirmarFechou(o)}>
                        {!ocupado && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} Confirmar venda
                      </Button>
                    </div>
                  </div>
                )}

                {/* Painel do "Não fechou" */}
                {aberto && modo === 'perdido' && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Por quê? (opcional)</p>
                    <div className="flex flex-wrap gap-2">
                      {MOTIVOS_PERDA.map((m) => (
                        <button
                          key={m}
                          disabled={ocupado}
                          onClick={() => marcar(o, 'perdido', { desfecho_motivo: m })}
                          className="rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                        >
                          {m}
                        </button>
                      ))}
                      <button
                        disabled={ocupado}
                        onClick={() => marcar(o, 'perdido')}
                        className="rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        Não disse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <JanelaDados className="mt-6" />
    </>
  )
}

function Resumo({ icone, rotulo, valor, alerta }: {
  icone: ReactNode
  rotulo: string
  valor: string
  alerta?: boolean
}) {
  return (
    <div className={cn('rounded-xl border bg-card px-3 py-2.5 text-center shadow-sm',
      alerta && 'border-amber-500/30 bg-amber-500/[0.04]')}>
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <span className={cn(alerta && 'text-amber-600 dark:text-amber-400')} aria-hidden="true">{icone}</span>
        <span className="text-[11px] font-medium">{rotulo}</span>
      </div>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-foreground">{valor}</p>
    </div>
  )
}
