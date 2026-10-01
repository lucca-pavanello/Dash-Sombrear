/**
 * Relatórios por canal — a pergunta do gestor de tráfego.
 *
 * "Filtrar o mês de agosto: a quantidade de fechamentos do Google foi tanto
 *  e o faturamento pelo Google foi tanto."
 *
 * Duas fontes que só agora se encontram: a origem nasce no lead (WhatsApp) e
 * o dinheiro mora no orçamento. A venda carrega o canal em `orcamentos.origem`
 * quando alguém marca na mão no Semanário — mas venda de balcão raramente tem
 * isso preenchido. Pra essas, casamos pelo TELEFONE com um lead que já
 * conversou com a Stella (`origemEfetiva`) — o pulo aqui é normalizar o
 * telefone antes (tira o 55 e o 9º dígito extra), senão o número digitado na
 * loja quase nunca bate igual ao do WhatsApp e o casamento não serve pra nada.
 */
import { useMemo, useState } from 'react'
import { BarChart3, ChevronRight, Download, Thermometer, TrendingUp } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useCrmLeads, isLeadHistorico, mapaLeadsPorTelefone, acharLeadPorTelefone } from '@/hooks/useAgenteIA'
import { intervaloAtual } from '@/lib/periodos'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { Button, EmptyState } from '@/components/ui/primitives'
import { tabela } from '@/components/shared/estilos'
import SeloOrigem, { ORIGENS, SEM_ORIGEM, acharOrigem } from '@/components/agente/SeloOrigem'
import { TEMPERATURAS, acharTemperatura } from '@/components/agente/SeloTemperatura'
import { TEMA_TABELA, alinharSecoes, colunasCentro, colunasDireita, faixaMarca, rodapeMarca } from '@/lib/pdfMarca'
import type { Orcamento } from '@/lib/supabase'
import JanelaDados from '@/components/orcamentos/JanelaDados'
import AvisoErro from '@/components/shared/AvisoErro'
import ResumosIA from '@/components/relatorios/ResumosIA'
import FunilConversao from '@/components/relatorios/FunilConversao'
import { dataVenda, ehTeste, ehVenda, noPeriodo } from '@/lib/analises/base'
import { leadsQueCompraram } from '@/lib/analises/conversao'
import { linhasPorCanal, mesAMes, somarCanais } from '@/lib/relatorios/porCanal'

const PERIODOS = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'ano', label: 'Este ano' },
  { value: 'todos', label: 'Tudo' },
  { value: 'custom', label: 'Escolher datas' },
]

// A definição de receita desta aba virou a definição do projeto: mora em
// src/lib/analises/base.ts e a aba Análises importa a mesma. Antes cada uma tinha a sua
// e as duas abas da MESMA área mostravam faturamentos diferentes para o mesmo mês.

const rotuloMes = (ym: string) => {
  const [a, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${a.slice(2)}`
}

export default function TabRelatorios() {
  // isPending, não isLoading: primeira leitura com a nova tentativa pausada (aba em segundo plano)
  // continua sendo "carregando", nunca zeros
  const { data: orcamentos = [], isPending: isLoading, isError: erroOrc, refetch: releOrc } = useOrcamentos()
  const { data: leads = [], isPending: carregandoLeads, isError: erroLeads, refetch: releLeads } = useCrmLeads()
  const [periodo, setPeriodo] = useState('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [baixando, setBaixando] = useState(false)

  // mesmo intervalo e mesma data de venda da aba Análises (src/lib/periodos.ts)
  const faixa = useMemo(() => intervaloAtual(periodo, de || undefined, ate || undefined), [periodo, de, ate])
  const vendasNoPeriodo = useMemo(
    () => orcamentos.filter(o => ehVenda(o) && !ehTeste(o) && noPeriodo(dataVenda(o), faixa)),
    [orcamentos, faixa])
  // Fora o histórico do WhatsApp da loja (importado só pra dar contexto à IA) —
  // senão cada leva de conversa antiga vira um monte de "leads novos" no período.
  const leadsVivos = useMemo(() => leads.filter(l => !isLeadHistorico(l)), [leads])
  const leadsNoPeriodo = useMemo(
    () => leadsVivos.filter(l => noPeriodo(l.created_at, faixa)),
    [leadsVivos, faixa])
  // Telefone → lead, pra saber de onde veio uma venda de balcão sem canal marcado
  // na mão — mesmo que ela tenha fechado fora do chat com a Stella.
  const leadPorTelefone = useMemo(() => mapaLeadsPorTelefone(leads), [leads])
  const origemEfetiva = (o: Orcamento) =>
    o.origem || acharLeadPorTelefone(leadPorTelefone, o.telefone)?.origem || null

  /**
   * Uma linha por canal: quantos chegaram, quantos receberam preço, quantos
   * fecharam. "Orçados" vem do LEAD (recebeu valor no WhatsApp) — a tabela
   * `orcamentos` não serve de meio de funil porque 98% dela é uso interno da
   * calculadora, não proposta a cliente. Venda conta de qualquer canal —
   * balcão puro cai em "Sem origem" só se o telefone também não bater com
   * nenhum lead conhecido (ver `origemEfetiva`).
   */
  const compraram = useMemo(
    () => leadsQueCompraram(orcamentos, tel => acharLeadPorTelefone(leadPorTelefone, tel)),
    [orcamentos, leadPorTelefone])
  const porCanal = useMemo(() => {
    const ordem: string[] = [...ORIGENS.map(o => o.id), SEM_ORIGEM.id]
    return linhasPorCanal({
      leads: leadsNoPeriodo,
      vendas: vendasNoPeriodo,
      canalDoLead: l => acharOrigem(l.origem).id,
      canalDaVenda: o => acharOrigem(origemEfetiva(o)).id,
      compraram,
    })
      .filter(v => v.leads > 0 || v.fechamentos > 0)
      .sort((a, b) => b.faturamento - a.faturamento || ordem.indexOf(a.id) - ordem.indexOf(b.id))
  }, [vendasNoPeriodo, leadsNoPeriodo, leadPorTelefone, compraram])

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

  /** vendas fechadas ainda sem canal e sem lead conhecido pelo telefone — é o que trava o relatório */
  const semCanal = useMemo(
    () => new Set(vendasNoPeriodo
      .filter(o => !o.origem && !acharLeadPorTelefone(leadPorTelefone, o.telefone))
      .map(o => o.pedido_id ?? o.id)).size,
    [vendasNoPeriodo, leadPorTelefone])

  const totais = useMemo(() => somarCanais(porCanal), [porCanal])

  /** Mês a mês — o "resultado que ele mostra pro cliente": últimos 6 meses, fora do filtro */
  const porMes = useMemo(
    () => mesAMes(orcamentos, o => acharOrigem(origemEfetiva(o)).id),
    [orcamentos, leadPorTelefone])

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
        head: [['Canal', 'Leads', 'Orçados', 'Pedidos', 'Conversão', 'Faturamento', 'Ticket médio']],
        body: porCanal.map(c => [
          acharOrigem(c.id).rotulo, String(c.leads), String(c.orcados), String(c.fechamentos),
          c.conversao != null ? `${c.conversao.toFixed(0)}%` : '—',
          formatCurrency(c.faturamento), c.ticket > 0 ? formatCurrency(c.ticket) : '—',
        ]),
        foot: [['TOTAL', String(totais.leads), String(totais.orcados), String(totais.fechamentos),
          totais.conversao != null ? `${totais.conversao.toFixed(0)}%` : '—',
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

  // Os quatro estados (DESIGN.md + padrão TECPAV/Garimpo). Cabeçalho, filtro e os Resumos
  // (que têm leitura própria) ficam de pé em todos. Carregando espera os leads também: antes
  // o funil dizia "nenhum lead" enquanto eles chegavam.
  const carregando = isLoading || carregandoLeads
  const semLeitura = (erroOrc && orcamentos.length === 0) || (erroLeads && leads.length === 0)
  const tentarDeNovo = () => {
    if (erroOrc) void releOrc()
    if (erroLeads) void releLeads()
  }
  const vazio = !carregando && !semLeitura && porCanal.length === 0
  const tituloVazio = periodo === 'custom' ? 'Nada nessas datas'
    : periodo === 'todos' ? 'Nada registrado ainda'
    : `Nada em ${(PERIODOS.find(p => p.value === periodo)?.label ?? 'este período').toLowerCase()}`

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
            Quanto entrou, quantos compraram e por onde o cliente veio.
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
        <Button variant="outline" onClick={exportarPdf} loading={baixando} disabled={carregando || porCanal.length === 0}>
          {!baixando && <Download className="h-4 w-4" aria-hidden="true" />}
          PDF
        </Button>
      </div>

      {carregando ? (
        <EsqueletoPorCanal />
      ) : semLeitura ? (
        <AvisoErro mensagem="Não consegui ler os números agora." aoTentar={tentarDeNovo} className="mb-4 py-8" />
      ) : vazio ? (
        <div className="mb-4 rounded-xl border bg-card shadow-sm">
          <EmptyState icon={BarChart3} titulo={tituloVazio}
            dica="Os leads aparecem quando alguém fala com a Amanda no WhatsApp, e os pedidos quando a venda entra no Semanário."
            className="px-6 pb-4 pt-10" />
          {periodo !== '90d' && periodo !== 'todos' && (
            <div className="flex justify-center pb-10">
              <Button variant="outline" size="sm" onClick={() => setPeriodo('90d')}>Ver últimos 90 dias</Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {(erroOrc || erroLeads) && (
            <AvisoErro mensagem="Não consegui atualizar agora. Mostrando o que foi lido por último."
              aoTentar={tentarDeNovo} className="mb-4" />
          )}

          <FunilConversao leads={totais.leads} orcados={totais.orcados} convertidos={totais.convertidos}
            pedidos={totais.fechamentos} faturamento={totais.faturamento} />

          {semCanal > 0 && (
            <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-2.5 text-center text-xs text-muted-foreground">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {semCanal} pedido{semCanal > 1 ? 's' : ''} sem canal
              </span>
              {' '}caem em “Sem origem”. Marque em Semanário → abrir a venda → <b>De onde veio este cliente</b>.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {/* Canal fica fixo e Pedidos/Faturamento vêm logo depois: no celular a tabela rola
                de lado, e antes o faturamento, a coluna que importa, ficava fora da tela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tabela.theadRow}>
                    <th className={cn(tabela.th, 'sticky left-0 z-10 text-center', FUNDO_CABECALHO)}>Canal</th>
                    <th className={cn(tabela.th, 'text-center')}>Pedidos</th>
                    <th className={cn(tabela.th, 'text-center')}>Faturamento</th>
                    <th className={cn(tabela.th, 'text-center')}>Ticket médio</th>
                    <th className={cn(tabela.th, 'text-center')} title="Leads do canal no período que compraram">Conversão</th>
                    <th className={cn(tabela.th, 'text-center')}>Leads</th>
                    <th className={cn(tabela.th, 'text-center')}>Orçados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {porCanal.map(c => (
                    <tr key={c.id} className={tabela.tr}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-3 text-center"><SeloOrigem origem={c.id} /></td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums">{c.fechamentos || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-foreground">
                        {c.faturamento > 0 ? formatCurrency(c.faturamento) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {c.ticket > 0 ? formatCurrency(c.ticket) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {c.conversao != null ? (
                          <span className={cn('text-sm', c.conversao >= 30 ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                            {c.conversao.toFixed(0)}%
                          </span>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.leads || '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.orcados || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/20 font-bold">
                    <td className={cn('sticky left-0 z-10 px-4 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground', FUNDO_RODAPE)}>Total</td>
                    <td className="px-4 py-3 text-center tabular-nums">{totais.fechamentos}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground">{formatCurrency(totais.faturamento)}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {totais.ticket > 0 ? formatCurrency(totais.ticket) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {totais.conversao != null ? `${totais.conversao.toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{totais.leads}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{totais.orcados}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
        </>
      )}

      <ResumosIA />

      {/* Mês a mês não segue o filtro de período: mora no fim e diz isso (padrão Garimpo).
          O total de cada mês vai no cabeçalho, que custa menos altura que uma linha a mais */}
      {!carregando && !semLeitura && porMes.canais.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b px-5 py-3">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold tracking-wide">Mês a mês</h3>
            <span className="text-xs text-muted-foreground">faturamento por canal nos últimos 6 meses, fora do filtro</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tabela.theadRow}>
                  <th className={cn(tabela.th, 'sticky left-0 z-10 text-center', FUNDO_CABECALHO)}>Canal</th>
                  {porMes.meses.map(m => {
                    const total = porMes.canais.reduce((s, c) => s + porMes.valor(m, c).total, 0)
                    return (
                      <th key={m} className={cn(tabela.th, 'text-center')}>
                        {rotuloMes(m)}
                        <span className="block text-xs font-bold normal-case tracking-normal tabular-nums text-foreground">
                          {total > 0 ? formatCurrency(total) : '—'}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {porMes.canais.map(canal => (
                  <tr key={canal} className={tabela.tr}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-3 text-center"><SeloOrigem origem={canal} /></td>
                    {porMes.meses.map(m => {
                      const { n, total } = porMes.valor(m, canal)
                      return (
                        <td key={m} className="px-4 py-3 text-center tabular-nums">
                          {n > 0 ? (
                            <>
                              <span className="block font-semibold">{formatCurrency(total)}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {n} pedido{n > 1 ? 's' : ''}
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

      <JanelaDados className="mt-6" />
    </>
  )
}

/** A coluna Canal fica fixa na rolagem lateral, então precisa de fundo opaco com o mesmo tom da linha. */
const FUNDO_CABECALHO = '[background:linear-gradient(hsl(var(--muted)/0.4),hsl(var(--muted)/0.4)),hsl(var(--card))]'
const FUNDO_RODAPE = '[background:linear-gradient(hsl(var(--muted)/0.2),hsl(var(--muted)/0.2)),hsl(var(--card))]'

/**
 * Esqueleto do card do funil e da tabela, com a mesma forma (DESIGN.md: nunca spinner no meio
 * do conteúdo). Linhas de texto em 1lh na fonte do texto real.
 */
function EsqueletoPorCanal() {
  const linha = (fonte: string, largura: string) => (
    <span className={cn('flex h-[1lh] items-center', fonte)}><span className={cn('h-[0.7em] rounded skeleton-shimmer', largura)} /></span>
  )
  return (
    <div aria-busy="true" aria-label="Carregando os números">
      <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border/60 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="col-span-2 flex flex-col items-center bg-card px-3 py-2.5 sm:col-span-1">
              {linha('text-[10px]', 'w-14')}
              {linha('text-2xl sm:text-3xl', 'w-40')}
            </div>
            {[0, 1].map(i => (
              <div key={i} className="flex flex-col items-center bg-card px-3 py-2.5">
                {linha('text-[10px]', 'w-14')}
                {linha('text-base sm:text-lg', 'w-20')}
                {linha('text-[10px]', 'w-16')}
              </div>
            ))}
          </div>
          {[0, 1, 2].map(i => (
            <div key={i}>
              {i > 0 && <div className="py-2">{linha('text-[11px]', 'w-24')}</div>}
              <div className="flex items-baseline justify-between gap-3">
                {linha('text-sm', 'w-48')}
                {linha('text-xl', 'w-8')}
              </div>
              <div className="mt-1.5 h-2.5 rounded-full skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
      <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className={cn(tabela.theadRow, 'px-4 py-3')}>{linha('text-[11px]', 'w-2/3')}</div>
        {/* linha real: 57px (célula py-3 com o selo do canal); rodapé do total: 44px */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex h-[57px] items-center gap-6 border-b border-border/60 px-4">
            <span className="h-[22px] w-24 shrink-0 rounded-full skeleton-shimmer" />
            {linha('flex-1 text-sm', 'w-full')}
          </div>
        ))}
        <div className="flex h-11 items-center bg-muted/20 px-4">{linha('text-xs', 'w-full')}</div>
      </div>
    </div>
  )
}
