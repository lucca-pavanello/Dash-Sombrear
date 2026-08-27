/**
 * Relatórios por canal — a pergunta do gestor de tráfego.
 *
 * "Filtrar o mês de agosto: a quantidade de fechamentos do Google foi tanto
 *  e o faturamento pelo Google foi tanto."
 *
 * Duas fontes que só agora se encontram: a origem nasce no lead (WhatsApp) e
 * o dinheiro mora no orçamento. Por isso a venda carrega o próprio canal em
 * `orcamentos.origem` — herdado do lead quando vem dele, marcado na mão no
 * Semanário quando é balcão. Sem esse campo o relatório seria um chute por
 * telefone, e telefone quase nunca bate.
 */
import { useMemo, useState } from 'react'
import { BarChart3, ChevronRight, Download, Loader2, Thermometer, TrendingUp } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useCrmLeads } from '@/hooks/useAgenteIA'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { Button, EmptyState } from '@/components/ui/primitives'
import { tabela } from '@/components/shared/estilos'
import SeloOrigem, { ORIGENS, SEM_ORIGEM, acharOrigem } from '@/components/agente/SeloOrigem'
import { TEMPERATURAS, acharTemperatura } from '@/components/agente/SeloTemperatura'
import { TEMA_TABELA, alinharSecoes, colunasCentro, colunasDireita, faixaMarca, rodapeMarca } from '@/lib/pdfMarca'
import type { Orcamento } from '@/lib/supabase'
import JanelaDados from '@/components/orcamentos/JanelaDados'
import ResumosIA from '@/components/relatorios/ResumosIA'
import FunilConversao from '@/components/relatorios/FunilConversao'

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

  /**
   * Uma linha por canal: quantos chegaram, quantos receberam preço, quantos
   * fecharam. "Orçados" vem do LEAD (recebeu valor no WhatsApp) — a tabela
   * `orcamentos` não serve de meio de funil porque 98% dela é uso interno da
   * calculadora, não proposta a cliente. Venda conta de qualquer canal,
   * inclusive balcão (aí só fechamento e faturamento, sem lead).
   */
  const porCanal = useMemo(() => {
    const recebeuPreco = (v: unknown) => {
      const s = String(v ?? '').trim()
      return s !== '' && s !== '0' && s.toLowerCase() !== 'null'
    }
    const vazio = () => ({ leads: 0, orcados: 0, fechamentos: 0, faturamento: 0 })
    const mapa = new Map<string, ReturnType<typeof vazio>>()
    const pega = (id: string) => {
      const atual = mapa.get(id) ?? vazio()
      mapa.set(id, atual)
      return atual
    }
    for (const l of leadsNoPeriodo) {
      const linha = pega(acharOrigem(l.origem).id)
      linha.leads++
      if (recebeuPreco(l.ultimo_valor_cotado)) linha.orcados++
    }
    for (const o of noPeriodo) {
      if (!o.fechado) continue
      const linha = pega(acharOrigem(o.origem).id)
      linha.fechamentos++
      linha.faturamento += receita(o)
    }
    const ordem: string[] = [...ORIGENS.map(o => o.id), SEM_ORIGEM.id]
    return [...mapa.entries()]
      .filter(([, v]) => v.leads > 0 || v.fechamentos > 0)
      .sort((a, b) => b[1].faturamento - a[1].faturamento
        || ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([id, v]) => ({ id, ...v,
        ticket: v.fechamentos > 0 ? v.faturamento / v.fechamentos : 0,
        conversao: v.leads > 0 ? (v.fechamentos / v.leads) * 100 : null,
      }))
  }, [noPeriodo, leadsNoPeriodo])

  /**
   * Qualidade do lead por canal — quantidade já a tabela acima mostra; isso mostra
   * SE o que chega é bom. A Amanda calcula esse score/temperatura a cada conversa
   * (motor determinístico, não IA generativa) e até 27/08 isso nunca teve tela —
   * o time só via abrindo o Supabase direto.
   */
  type TempId = 'quente' | 'morno' | 'frio' | 'gelado' | 'descarte'
  const qualidadePorCanal = useMemo(() => {
    const vazio = () => ({
      quente: 0, morno: 0, frio: 0, gelado: 0, descarte: 0,
      semAvaliacao: 0, somaScore: 0, comScore: 0,
    })
    const mapa = new Map<string, ReturnType<typeof vazio>>()
    const pega = (id: string) => {
      const atual = mapa.get(id) ?? vazio()
      mapa.set(id, atual)
      return atual
    }
    for (const l of leadsNoPeriodo) {
      const linha = pega(acharOrigem(l.origem).id)
      const t = acharTemperatura(l.lead_temperatura)
      if (t.id === 'sem_temperatura') linha.semAvaliacao++
      else linha[t.id as TempId]++
      if (l.lead_score != null) { linha.somaScore += Number(l.lead_score); linha.comScore++ }
    }
    const ordem: string[] = [...ORIGENS.map(o => o.id), SEM_ORIGEM.id]
    return [...mapa.entries()]
      .filter(([, v]) => v.quente + v.morno + v.frio + v.gelado + v.descarte + v.semAvaliacao > 0)
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([id, v]) => ({
        id, ...v,
        avaliados: v.quente + v.morno + v.frio + v.gelado + v.descarte,
        scoreMedio: v.comScore > 0 ? v.somaScore / v.comScore : null,
      }))
  }, [leadsNoPeriodo])

  /** vendas fechadas ainda sem canal — é o que trava o relatório */
  const semCanal = useMemo(
    () => noPeriodo.filter(o => o.fechado && !o.origem).length,
    [noPeriodo])

  const totais = useMemo(() => porCanal.reduce((s, c) => ({
    leads: s.leads + c.leads,
    orcados: s.orcados + c.orcados,
    fechamentos: s.fechamentos + c.fechamentos,
    faturamento: s.faturamento + c.faturamento,
  }), { leads: 0, orcados: 0, fechamentos: 0, faturamento: 0 }), [porCanal])

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
        head: [['Canal', 'Leads', 'Orçados', 'Vendas', 'Conversão', 'Faturamento', 'Ticket médio']],
        body: porCanal.map(c => [
          acharOrigem(c.id).rotulo, String(c.leads), String(c.orcados), String(c.fechamentos),
          c.conversao != null ? `${c.conversao.toFixed(0)}%` : '—',
          formatCurrency(c.faturamento), c.ticket > 0 ? formatCurrency(c.ticket) : '—',
        ]),
        foot: [['TOTAL', String(totais.leads), String(totais.orcados), String(totais.fechamentos),
          totais.leads > 0 ? `${((totais.fechamentos / totais.leads) * 100).toFixed(0)}%` : '—',
          formatCurrency(totais.faturamento), '']],
        ...TEMA_TABELA,
        columnStyles: { ...colunasCentro([1, 2, 3, 4]), ...colunasDireita([5, 6]) },
        didParseCell: alinharSecoes({ 1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'right', 6: 'right' }),
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

      <FunilConversao leads={totais.leads} orcados={totais.orcados}
        fechados={totais.fechamentos} faturamento={totais.faturamento} />

      {semCanal > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {semCanal} venda{semCanal > 1 ? 's' : ''} sem canal marcado
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enquanto o canal não estiver preenchido, tudo cai em “Sem origem”. Marque em Semanário →
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
            dica="A origem é marcada no lead quando o cliente chega pelo WhatsApp, ou na mão pelo Semanário — abra a venda e escolha o canal em Ajustar valores."
            className="px-6 py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tabela.theadRow}>
                  <th className={cn(tabela.th, 'text-center')}>Canal</th>
                  <th className={cn(tabela.th, 'text-center')}>Leads</th>
                  <th className={cn(tabela.th, 'text-center')}>Orçados</th>
                  <th className={cn(tabela.th, 'text-center')}>Vendas</th>
                  <th className={cn(tabela.th, 'text-center')}>Conversão</th>
                  <th className={cn(tabela.th, 'text-center')}>Faturamento</th>
                  <th className={cn(tabela.th, 'text-center')}>Ticket médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porCanal.map(c => (
                  <tr key={c.id} className={tabela.tr}>
                    <td className="px-4 py-3 text-center"><SeloOrigem origem={c.id} /></td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.leads || '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.orcados || '—'}</td>
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
                  <td className="px-4 py-3 text-center tabular-nums">{totais.orcados}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totais.fechamentos}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {totais.leads > 0
                      ? `${((totais.fechamentos / totais.leads) * 100).toFixed(0)}%`
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

      {qualidadePorCanal.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-center gap-2 border-b px-5 py-3">
            <Thermometer className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold tracking-wide">Qualidade do lead por canal</h3>
            <span className="text-xs text-muted-foreground">o que a Amanda avaliou de cada conversa</span>
          </div>
          <div className="divide-y divide-border/50">
            {qualidadePorCanal.map(c => (
              <div key={c.id} className="flex flex-col gap-2.5 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="w-32 shrink-0"><SeloOrigem origem={c.id} /></div>
                <div className="min-w-0 flex-1">
                  {c.avaliados > 0 ? (
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img"
                      aria-label={`${c.avaliados} leads avaliados neste canal`}>
                      {TEMPERATURAS.map(t => {
                        const n = c[t.id as TempId]
                        if (!n) return null
                        return (
                          <div key={t.id} title={`${t.rotulo}: ${n}`}
                            className={cn(t.barra, 'h-full first:rounded-l-full last:rounded-r-full')}
                            style={{ width: `${(n / c.avaliados) * 100}%` }} />
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-2.5 w-full rounded-full bg-muted/40" />
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <span className="text-xs text-muted-foreground">
                    {c.avaliados} avaliado{c.avaliados !== 1 ? 's' : ''}
                  </span>
                  <div className="w-16 text-right">
                    {c.scoreMedio != null ? (
                      <span className="font-display text-base font-bold tabular-nums">{c.scoreMedio.toFixed(0)}</span>
                    ) : <span className="text-sm text-muted-foreground/40">—</span>}
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">score</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t px-5 py-2.5">
            {TEMPERATURAS.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', t.barra)} aria-hidden="true" /> {t.rotulo}
              </span>
            ))}
          </div>
        </div>
      )}

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
                <tr className={tabela.theadRow}>
                  <th className={cn(tabela.th, 'text-center')}>Canal</th>
                  {porMes.meses.map(m => (
                    <th key={m} className={cn(tabela.th, 'text-center')}>{rotuloMes(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porMes.canais.map(canal => (
                  <tr key={canal} className={tabela.tr}>
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

      <ResumosIA />

      <JanelaDados className="mt-6" />
    </>
  )
}
