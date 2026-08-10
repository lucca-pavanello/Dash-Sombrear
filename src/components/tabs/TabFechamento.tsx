/**
 * Fechamento — o dinheiro das vendas que a loja efetivou.
 * Entra aqui tudo que for marcado como venda na Planilha (fechado = true),
 * não importa a origem: agente de IA, balcão ou lançamento manual.
 * Mostra o que o cliente pagou, quanto vai para a empresa parceira e o que
 * sobra para a loja — com totais do período para fechar o mês.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import {
  Check, CheckCircle2, ChevronRight, Download, HandCoins, Loader2, PencilLine, Plus, Wallet, X,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { useCountUp } from '@/hooks/useCountUp'
import { supabase, type Orcamento } from '@/lib/supabase'

const TabSimulador = lazy(() => import('@/components/tabs/TabSimulador'))

const PERIODOS = [
  { value: 'mes', label: 'Este mês' },
  { value: 'semana', label: 'Últimos 7 dias' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ano', label: 'Este ano' },
  { value: 'todos', label: 'Tudo' },
  { value: 'custom', label: 'Escolher datas' },
]

/** Custo real da loja: nos itens da parceira é o que vai pra ela; nos demais, o custo gravado. */
const custoReal = (o: Orcamento) =>
  Number(o.valor_parceiro) > 0 ? Number(o.valor_parceiro) : Number(o.custo_tecido ?? 0)
const receita = (o: Orcamento) => Number(o.valor_venda ?? 0) + Number(o.instalacao ?? 0)
/** o que o cliente REALMENTE pagou (desconto/acréscimo na mão) — cai no calculado quando não houve ajuste */
const pago = (o: Orcamento) => o.valor_cobrado != null ? Number(o.valor_cobrado) : receita(o)
/** o que REALMENTE foi pago à parceira */
const pagoParceira = (o: Orcamento) =>
  o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : Number(o.valor_parceiro ?? 0)
const ajustado = (calc: number, real: number) => Math.abs(calc - real) >= 0.01

/** "R$ 792,50 (R$ 750,00)" — calculado com o realmente pago entre parênteses */
function ValorComReal({ calc, real, classe }: { calc: number; real: number; classe?: string }) {
  if (!ajustado(calc, real)) return <span className={classe}>{formatCurrency(calc)}</span>
  return (
    <span className={classe}>
      <span className="text-muted-foreground/60 line-through decoration-1">{formatCurrency(calc)}</span>{' '}
      <strong>({formatCurrency(real)})</strong>
    </span>
  )
}

function Kpi({ rotulo, valor, hint, destaque, contar }: {
  rotulo: string; valor: number; hint?: string; destaque?: 'primary' | 'emerald' | 'amber'; contar: boolean
}) {
  const anim = useCountUp(valor, 700, contar)
  return (
    <div className={cn(
      'rounded-xl border-2 bg-card p-4 shadow-sm',
      destaque === 'primary' ? 'border-primary/25' :
      destaque === 'emerald' ? 'border-emerald-500/25' :
      destaque === 'amber' ? 'border-amber-500/25' : 'border-border',
    )}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{rotulo}</p>
      <p className={cn(
        'font-display text-2xl font-bold tabular-nums',
        destaque === 'primary' ? 'text-primary' :
        destaque === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
        destaque === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
      )}>
        {formatCurrency(anim)}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function TabFechamento() {
  const { data: todos = [], isLoading, refetch } = useOrcamentos()
  const [calculando, setCalculando] = useState(false)
  const [periodo, setPeriodo] = useState('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [baixando, setBaixando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<{ cobrado: string; parceira: string }>({ cobrado: '', parceira: '' })
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  function abrirAjuste(o: Orcamento) {
    setEditando(o.id)
    setRascunho({
      cobrado: o.valor_cobrado != null ? String(o.valor_cobrado) : '',
      parceira: o.valor_parceiro_pago != null ? String(o.valor_parceiro_pago) : '',
    })
  }

  async function salvarAjuste(id: string) {
    setSalvandoAjuste(true)
    try {
      const numero = (s: string) => {
        const v = parseFloat(s.replace(',', '.'))
        return Number.isFinite(v) && v > 0 ? v : null
      }
      const { error } = await supabase.from('orcamentos').update({
        valor_cobrado: numero(rascunho.cobrado),
        valor_parceiro_pago: numero(rascunho.parceira),
      }).eq('id', id)
      if (error) throw error
      setEditando(null)
      await refetch()
    } finally {
      setSalvandoAjuste(false)
    }
  }

  const vendas = useMemo(() => {
    const fechados = todos.filter(o => o.fechado === true)
    return filterByPeriod(fechados, periodo, o => o.created_at, de || undefined, ate || undefined)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [todos, periodo, de, ate])

  const totais = useMemo(() => {
    const bruto = vendas.reduce((s, o) => s + pago(o), 0)
    const parceira = vendas.reduce((s, o) => s + pagoParceira(o), 0)
    const custo = vendas.reduce((s, o) => s + (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o)), 0)
    const ajustes = vendas.filter(o => o.valor_cobrado != null || o.valor_parceiro_pago != null).length
    // o que teria sido sem desconto/acréscimo dado na mão — serve de régua na negociação
    const brutoCalc = vendas.reduce((s, o) => s + receita(o), 0)
    const custoCalc = vendas.reduce((s, o) => s + custoReal(o), 0)
    return {
      bruto, parceira, custo, sobra: bruto - custo, ajustes,
      sobraCalc: brutoCalc - custoCalc,
      pctReal: bruto > 0 ? ((bruto - custo) / bruto) * 100 : 0,
      pctCalc: brutoCalc > 0 ? ((brutoCalc - custoCalc) / brutoCalc) * 100 : 0,
    }
  }, [vendas])

  async function exportarPdf() {
    if (baixando || vendas.length === 0) return
    setBaixando(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ])
      const doc = new jsPDF({ orientation: 'landscape' })
      const laranja: [number, number, number] = [232, 112, 26]
      doc.setFillColor(...laranja)
      doc.rect(0, 0, 297, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Sombrear — Fechamento de vendas', 14, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const rotuloPeriodo = PERIODOS.find(p => p.value === periodo)?.label ?? ''
      doc.text(`${rotuloPeriodo}${de || ate ? ` (${de} a ${ate})` : ''} · ${vendas.length} venda(s)`, 283, 14, { align: 'right' })

      autoTable(doc, {
        startY: 28,
        head: [['Data', 'Cliente', 'Produto', 'Medidas', 'Cliente pagou', 'À parceira', 'Sobra']],
        body: vendas.map(o => [
          formatDate(o.created_at),
          o.cliente ?? '—',
          [o.modelo, o.tecido].filter(Boolean).join(' · '),
          o.largura && o.altura ? `${o.largura}×${o.altura}m` : '—',
          ajustado(receita(o), pago(o)) ? `${formatCurrency(receita(o))} → ${formatCurrency(pago(o))}` : formatCurrency(pago(o)),
          ajustado(Number(o.valor_parceiro ?? 0), pagoParceira(o))
            ? `${formatCurrency(Number(o.valor_parceiro ?? 0))} → ${formatCurrency(pagoParceira(o))}`
            : formatCurrency(pagoParceira(o)),
          formatCurrency(pago(o) - (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o))),
        ]),
        foot: [['', '', '', 'TOTAIS',
          formatCurrency(totais.bruto), formatCurrency(totais.parceira), formatCurrency(totais.sobra)]],
        theme: 'striped',
        headStyles: { fillColor: laranja, textColor: 255, fontSize: 9 },
        footStyles: { fillColor: [243, 245, 247], textColor: [24, 28, 36], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      })
      doc.save(`fechamento-sombrear-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" />
          <span className="text-xs font-medium text-primary">Fechamento</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Fechamento</h2>
          <p className="mt-0.5 text-sm text-foreground/50">
            As vendas efetivadas, quanto vai para a parceira e o que sobra para a loja.
          </p>
        </div>
      </div>

      {/* Filtros + ações */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CustomSelect className="w-44 py-2" value={periodo} onChange={setPeriodo} options={PERIODOS} />
        {periodo === 'custom' && (
          <>
            <DatePicker value={de} onChange={setDe} placeholder="De" triggerClassName="py-2" className="w-40" />
            <DatePicker value={ate} onChange={setAte} placeholder="Até" min={de || undefined} triggerClassName="py-2" className="w-40" />
          </>
        )}
        <div className="flex-1" />
        {(
          <button
            type="button"
            onClick={() => setCalculando(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-brand transition-all hover:opacity-95 active:scale-[0.98]"
          >
            <Plus className={cn('h-4 w-4 transition-transform', calculando && 'rotate-45')} />
            {calculando ? 'Fechar calculadora' : 'Nova venda'}
          </button>
        )}
        <button
          type="button"
          onClick={exportarPdf}
          disabled={baixando || vendas.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF
        </button>
      </div>

      {/* Calculadora — a venda cai direto neste fechamento */}
      {calculando && (
        <div className="mb-4 rounded-xl border-2 border-primary/25 bg-card p-4 shadow-sm sm:p-5">
          <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Carregando calculadora…</p>}>
            <TabSimulador modoVenda aoSalvar={() => refetch()} />
          </Suspense>
        </div>
      )}

      {/* Totais */}
      <div className="kpi-cascade mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Vendas no período" valor={totais.bruto} contar={!isLoading}
          hint={`${vendas.length} venda${vendas.length !== 1 ? 's' : ''} fechada${vendas.length !== 1 ? 's' : ''}` +
            (totais.ajustes ? ` · ${totais.ajustes} com ajuste manual` : '')} destaque="primary" />
        <Kpi rotulo="A pagar à parceira" valor={totais.parceira} contar={!isLoading}
          hint="produção das persianas de tecido" destaque="amber" />
        <Kpi rotulo="Custo total" valor={totais.custo} contar={!isLoading}
          hint="inclui itens fora da parceira" />
        <Kpi rotulo="Sobra para a loja" valor={totais.sobra} contar={!isLoading}
          hint={totais.bruto > 0
            ? `${totais.pctReal.toFixed(0)}% do faturamento` +
              (Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 ? ` · sem os ajustes seria ${totais.pctCalc.toFixed(0)}%` : '')
            : undefined}
          destaque="emerald" />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : vendas.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">Nenhuma venda fechada neste período</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Marque o orçamento como <strong>venda</strong> na Planilha (coluna Fechado) que ele aparece aqui —
              venha da IA, do balcão ou de lançamento manual.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-bold">Data</th>
                  <th className="px-4 py-3 text-left font-bold">Cliente</th>
                  <th className="px-4 py-3 text-left font-bold">Produto</th>
                  <th className="px-4 py-3 text-center font-bold">Medidas</th>
                  <th className="px-4 py-3 text-right font-bold">Cliente pagou</th>
                  <th className="px-4 py-3 text-right font-bold">À parceira</th>
                  <th className="px-4 py-3 text-right font-bold">Sobra</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {vendas.map(o => {
                  const bruto = receita(o)
                  const parceira = Number(o.valor_parceiro ?? 0)
                  const sobra = pago(o) - (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o))
                  const emEdicao = editando === o.id
                  return (
                    <tr key={o.id} className={cn('transition-colors hover:bg-primary/[0.03]', emEdicao && 'bg-primary/[0.04]')}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground tabular-nums">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{o.cliente ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="block text-foreground">{o.modelo ?? '—'}</span>
                        {o.tecido && <span className="text-xs">{o.tecido}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-muted-foreground tabular-nums">
                        {o.largura && o.altura ? `${o.largura}×${o.altura}m` : '—'}
                        {Number(o.quantidade) > 1 && <span className="ml-1">× {o.quantidade}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {emEdicao ? (
                          <input autoFocus className="w-28 rounded-md border border-primary/40 bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/15"
                            inputMode="decimal" placeholder={String(bruto.toFixed(2))}
                            value={rascunho.cobrado} onChange={e => setRascunho(r => ({ ...r, cobrado: e.target.value }))} />
                        ) : <ValorComReal calc={bruto} real={pago(o)} />}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {emEdicao ? (
                          <input className="w-28 rounded-md border border-primary/40 bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/15"
                            inputMode="decimal" placeholder={String(parceira.toFixed(2))}
                            value={rascunho.parceira} onChange={e => setRascunho(r => ({ ...r, parceira: e.target.value }))} />
                        ) : parceira > 0 || o.valor_parceiro_pago != null
                          ? <ValorComReal calc={parceira} real={pagoParceira(o)} />
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(() => {
                          const sobraCalc = bruto - custoReal(o)
                          const pctReal = pago(o) > 0 ? (sobra / pago(o)) * 100 : 0
                          const pctCalc = bruto > 0 ? (sobraCalc / bruto) * 100 : 0
                          const mudou = Math.abs(pctReal - pctCalc) >= 0.5
                          return (
                            <>
                              <span className="block font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sobra)}</span>
                              <span className={cn('block text-[11px]', mudou ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                                {pctReal.toFixed(0)}%{mudou && <> · seria {pctCalc.toFixed(0)}%</>}
                              </span>
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {emEdicao ? (
                          <span className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => salvarAjuste(o.id)} disabled={salvandoAjuste}
                              title="Salvar valores reais"
                              className="rounded-md p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-50">
                              {salvandoAjuste ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={() => setEditando(null)} title="Cancelar"
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => abrirAjuste(o)}
                            title="Ajustar o que foi realmente pago (desconto, acréscimo)"
                            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground">
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total do período
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(totais.bruto)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(totais.parceira)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="block text-emerald-600 dark:text-emerald-400">{formatCurrency(totais.sobra)}</span>
                    <span className={cn('block text-[11px] font-semibold',
                      Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                      {totais.pctReal.toFixed(0)}%
                      {Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 && <> · seria {totais.pctCalc.toFixed(0)}%</>}
                    </span>
                  </td>
                  <td className="px-2 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> "Cliente pagou" inclui a instalação quando houver.</span>
        <span className="inline-flex items-center gap-1"><PencilLine className="h-3 w-3" /> Deu desconto ou acréscimo na mão? Clique no lápis da linha: o valor calculado fica riscado e o realmente pago aparece entre parênteses — os totais usam o real.</span>
        <span className="inline-flex items-center gap-1"><HandCoins className="h-3 w-3" /> "À parceira" é o custo de produção das persianas de tecido (PV, PH Alumínio e PH 50mm não passam por ela).</span>
      </div>
    </>
  )
}
