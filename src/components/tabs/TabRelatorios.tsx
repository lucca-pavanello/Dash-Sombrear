/**
 * Relatórios por canal — a pergunta do gestor de tráfego.
 *
 * "Filtrar o mês de agosto: a quantidade de fechamentos do Google foi tanto
 *  e o faturamento pelo Google foi tanto."
 *
 * Duas fontes que só agora se encontram: a origem nasce no lead (WhatsApp) e
 * o dinheiro mora no orçamento. Por isso a venda carrega o próprio canal em
 * `orcamentos.origem` — herdado do lead quando vem dele, marcado na mão no
 * Fechamento quando é balcão. Sem esse campo o relatório seria um chute por
 * telefone, e telefone quase nunca bate.
 */
import { useMemo, useState } from 'react'
import { BarChart3, ChevronRight, Download, Loader2, TrendingUp } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useCrmLeads } from '@/hooks/useAgenteIA'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { Button, EmptyState } from '@/components/ui/primitives'
import SeloOrigem, { ORIGENS, SEM_ORIGEM, acharOrigem } from '@/components/agente/SeloOrigem'
import { TEMA_TABELA, colunasCentro, colunasDireita, faixaMarca, rodapeMarca } from '@/lib/pdfMarca'
import type { Orcamento } from '@/lib/supabase'

const PERIODOS = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'ano', label: 'Este ano' },
  { value: 'todos', label: 'Tudo' },
  { value: 'custom', label: 'Escolher datas' },
]

/** o que entrou de verdade: ajuste manual manda, senão o calculado */
const receita = (o: Orcamento) =>
  o.valor_cobrado != null
    ? Number(o.valor_cobrado)
    : Number(o.valor_venda ?? 0) + Number(o.instalacao ?? 0)

const mesDe = (iso: string) => iso.slice(0, 7)
const rotuloMes = (ym: string) => {
  const [a, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${a.slice(2)}`
}

export default function TabRelatorios() {
  const { data: orcamentos = [], isLoading } = useOrcamentos()
  const { data: leads = [] } = useCrmLeads()
  const [periodo, setPeriodo] = useState('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [baixando, setBaixando] = useState(false)

  const noPeriodo = useMemo(
    () => filterByPeriod(orcamentos, periodo, o => o.created_at, de || undefined, ate || undefined),
    [orcamentos, periodo, de, ate])
  const leadsNoPeriodo = useMemo(
    () => filterByPeriod(leads, periodo, l => l.created_at, de || undefined, ate || undefined),
    [leads, periodo, de, ate])

  /** Uma linha por canal: quantos chegaram, quantos fecharam, quanto entrou */
  const porCanal = useMemo(() => {
    const vazio = () => ({ leads: 0, orcamentos: 0, fechamentos: 0, faturamento: 0 })
    const mapa = new Map<string, ReturnType<typeof vazio>>()
    const pega = (id: string) => {
      const atual = mapa.get(id) ?? vazio()
      mapa.set(id, atual)
      return atual
    }
    for (const l of leadsNoPeriodo) pega(acharOrigem(l.origem).id).leads++
    for (const o of noPeriodo) {
      const linha = pega(acharOrigem(o.origem).id)
      linha.orcamentos++
      if (o.fechado) { linha.fechamentos++; linha.faturamento += receita(o) }
    }
    const ordem: string[] = [...ORIGENS.map(o => o.id), SEM_ORIGEM.id]
    return [...mapa.entries()]
      .filter(([, v]) => v.leads > 0 || v.orcamentos > 0)
      .sort((a, b) => b[1].faturamento - a[1].faturamento
        || ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([id, v]) => ({ id, ...v,
        ticket: v.fechamentos > 0 ? v.faturamento / v.fechamentos : 0,
        conversao: v.orcamentos > 0 ? (v.fechamentos / v.orcamentos) * 100 : null,
      }))
  }, [noPeriodo, leadsNoPeriodo])

  /** vendas fechadas ainda sem canal — é o que trava o relatório */
  const semCanal = useMemo(
    () => noPeriodo.filter(o => o.fechado && !o.origem).length,
    [noPeriodo])

  const totais = useMemo(() => porCanal.reduce((s, c) => ({
    leads: s.leads + c.leads,
    orcamentos: s.orcamentos + c.orcamentos,
    fechamentos: s.fechamentos + c.fechamentos,
    faturamento: s.faturamento + c.faturamento,
  }), { leads: 0, orcamentos: 0, fechamentos: 0, faturamento: 0 }), [porCanal])

  /** Mês a mês — o "resultado que ele mostra pro cliente" */
  const porMes = useMemo(() => {
    const fechados = orcamentos.filter(o => o.fechado)
    const meses = [...new Set(fechados.map(o => mesDe(o.created_at)))].sort().slice(-6)
    const canais = [...new Set(fechados.map(o => acharOrigem(o.origem).id))]
    return {
      meses,
      canais,
      valor: (mes: string, canal: string) => fechados
        .filter(o => mesDe(o.created_at) === mes && acharOrigem(o.origem).id === canal)
        .reduce((s, o) => ({ n: s.n + 1, total: s.total + receita(o) }), { n: 0, total: 0 }),
    }
  }, [orcamentos])

  async function exportarPdf() {
    setBaixando(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ])
      const doc = new jsPDF()
      const inicioY = faixaMarca(doc, 'Resultado por canal',
        PERIODOS.find(p => p.value === periodo)?.label ?? '')
      autoTable(doc, {
        startY: inicioY,
        head: [['Canal', 'Leads', 'Orçamentos', 'Fechamentos', 'Conversão', 'Faturamento', 'Ticket médio']],
        body: porCanal.map(c => [
          acharOrigem(c.id).rotulo, String(c.leads), String(c.orcamentos), String(c.fechamentos),
          c.conversao != null ? `${c.conversao.toFixed(0)}%` : '—',
          formatCurrency(c.faturamento), c.ticket > 0 ? formatCurrency(c.ticket) : '—',
        ]),
        foot: [['TOTAL', String(totais.leads), String(totais.orcamentos), String(totais.fechamentos),
          totais.orcamentos > 0 ? `${((totais.fechamentos / totais.orcamentos) * 100).toFixed(0)}%` : '—',
          formatCurrency(totais.faturamento), '']],
        ...TEMA_TABELA,
        columnStyles: { ...colunasCentro([1, 2, 3, 4]), ...colunasDireita([5, 6]) },
        margin: { left: 14, right: 14, bottom: 20 },
      })
      rodapeMarca(doc)
      doc.save(`resultado-por-canal-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" />
          <span className="text-xs font-medium text-primary">Relatórios</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Resultado por canal</h2>
          <p className="mt-0.5 text-sm text-foreground/50">
            Quantos chegaram, quantos fecharam e quanto entrou — por onde o cliente veio.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <CustomSelect className="w-44 py-2" value={periodo} onChange={setPeriodo} options={PERIODOS} />
        {periodo === 'custom' && (
          <>
            <DatePicker value={de} onChange={setDe} placeholder="De" className="w-40" />
            <DatePicker value={ate} onChange={setAte} placeholder="Até" min={de || undefined} className="w-40" />
          </>
        )}
        <Button variant="outline" onClick={exportarPdf} loading={baixando} disabled={porCanal.length === 0}>
          {!baixando && <Download className="h-4 w-4" aria-hidden="true" />}
          PDF
        </Button>
      </div>

      <div className="kpi-cascade mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: 'Leads no período', valor: String(totais.leads), hint: 'contatos que chegaram' },
          { rotulo: 'Orçamentos', valor: String(totais.orcamentos), hint: 'pedidos calculados' },
          { rotulo: 'Fechamentos', valor: String(totais.fechamentos), hint: 'viraram venda', destaque: true },
          { rotulo: 'Faturamento', valor: formatCurrency(totais.faturamento), hint: 'o que entrou', destaque: true },
        ].map(k => (
          <div key={k.rotulo} className={cn('rounded-xl border bg-card p-4 text-center shadow-sm transition-colors',
            k.destaque && 'border-emerald-500/25 bg-emerald-500/[0.04]')}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{k.rotulo}</p>
            <p className={cn('mt-1 font-display text-2xl font-bold tabular-nums',
              k.destaque && 'text-emerald-600 dark:text-emerald-400')}>{k.valor}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

      {semCanal > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {semCanal} venda{semCanal > 1 ? 's' : ''} sem canal marcado
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enquanto o canal não estiver preenchido, tudo cai em “Sem origem”. Marque em Fechamento →
            abrir a venda → <b>De onde veio este cliente</b>. Os que chegam pelo WhatsApp vêm preenchidos sozinhos.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : porCanal.length === 0 ? (
          <EmptyState icon={BarChart3} titulo="Nenhum dado neste período"
            dica="A origem é marcada no lead quando o cliente chega pelo WhatsApp, ou na mão pelo Fechamento — abra a venda e escolha o canal em Ajustar valores."
            className="px-6 py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-center font-bold">Canal</th>
                  <th className="px-4 py-3 text-center font-bold">Leads</th>
                  <th className="px-4 py-3 text-center font-bold">Orçamentos</th>
                  <th className="px-4 py-3 text-center font-bold">Fechamentos</th>
                  <th className="px-4 py-3 text-center font-bold">Conversão</th>
                  <th className="px-4 py-3 text-center font-bold">Faturamento</th>
                  <th className="px-4 py-3 text-center font-bold">Ticket médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porCanal.map(c => (
                  <tr key={c.id} className="transition-colors hover:bg-primary/[0.03]">
                    <td className="px-4 py-3 text-center"><SeloOrigem origem={c.id} /></td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.leads || '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.orcamentos || '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">{c.fechamentos || '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {c.conversao != null ? (
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',
                          c.conversao >= 30 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : c.conversao >= 15 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground')}>
                          {c.conversao.toFixed(0)}%
                        </span>
                      ) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.faturamento > 0 ? formatCurrency(c.faturamento) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {c.ticket > 0 ? formatCurrency(c.ticket) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/20 font-bold">
                  <td className="px-4 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totais.leads}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totais.orcamentos}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totais.fechamentos}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {totais.orcamentos > 0
                      ? `${((totais.fechamentos / totais.orcamentos) * 100).toFixed(0)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatCurrency(totais.faturamento)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {porMes.meses.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-center gap-2 border-b px-5 py-3">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold tracking-wide">Mês a mês</h3>
            <span className="text-xs text-muted-foreground">faturamento fechado por canal</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-center font-bold">Canal</th>
                  {porMes.meses.map(m => (
                    <th key={m} className="px-4 py-3 text-center font-bold">{rotuloMes(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porMes.canais.map(canal => (
                  <tr key={canal}>
                    <td className="px-4 py-3 text-center"><SeloOrigem origem={canal} /></td>
                    {porMes.meses.map(m => {
                      const { n, total } = porMes.valor(m, canal)
                      return (
                        <td key={m} className="px-4 py-3 text-center tabular-nums">
                          {n > 0 ? (
                            <>
                              <span className="block font-semibold">{formatCurrency(total)}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {n} venda{n > 1 ? 's' : ''}
                              </span>
                            </>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
