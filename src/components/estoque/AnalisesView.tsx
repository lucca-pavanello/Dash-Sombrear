import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  BarChart2, Activity, Truck, Layers, MapPin, Calendar, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { useParetoData, useGiroAnual } from '@/hooks/useEstoqueAnalytics'
import { useMargemEstoque } from '@/hooks/useEstoqueMargemEstoque'
import {
  useEstoquePerformanceFornecedor,
  useEstoquePerformanceCategoria,
  useEstoquePerformanceLocalizacao,
  useEstoqueSazonalidade,
} from '@/hooks/useEstoqueAnalyticsDescritivo'
import { NIVEIS_ACESSO } from '@/lib/constants'
import ParetoChart from './dashboard/ParetoChart'
import TopAClassTable from './dashboard/TopAClassTable'
import RecalcularABCButton from './dashboard/RecalcularABCButton'
import GiroMensalChart from './analises/GiroMensalChart'
import SectionCard from './shared/SectionCard'
import EstoqueTable, { type EstoqueTableColumn } from './shared/EstoqueTable'
import { ClasseABC } from './shared/ClasseABC'
import type { ToastType } from '@/hooks/useToast'
import type { CoberturaMargemRow } from '@/lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number, decimals = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalisesView({ toast }: Props) {
  return (
    <div className="space-y-6">
      <SecaoCurvaAbc toast={toast} />
      <SecaoPerformanceCategoria />
      <SecaoMaisRentaveis />
      <SecaoSazonalidade />
      <SecaoGiroMensal />
      <SecaoPerformanceFornecedor />
      <SecaoPerformanceLocalizacao />
    </div>
  )
}

// ─── S1: Curva ABC / O que mais vende ────────────────────────────────────────

function SecaoCurvaAbc({ toast }: { toast: (type: ToastType, message: string) => void }) {
  const { data: paretoData, isLoading } = useParetoData()
  const hasData = (paretoData?.totalVendas ?? 0) >= 5

  return (
    <SectionCard
      icon={BarChart2}
      title="O que mais vende"
      subtitle="Curva ABC: 20% dos produtos geram 80% do faturamento. Estes são os que importam."
      defaultOpen
    >
      <div className="p-4 space-y-4">
        {/* 3 colunas: a legenda fica no centro real, sem depender da largura do botão */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span />
          <p className="text-center text-xs text-muted-foreground">
            Curva ABC — Top 20 produtos (últimos 90 dias)
          </p>
          <div className="flex justify-end">
            <RecalcularABCButton toast={toast} />
          </div>
        </div>
        {!hasData && !isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Registre pelo menos 5 vendas para ver a Curva ABC.
          </div>
        ) : (
          <>
            <ParetoChart items={paretoData?.items ?? []} isLoading={isLoading} />
            <TopAClassTable items={paretoData?.items ?? []} isLoading={isLoading} />
          </>
        )}
      </div>
    </SectionCard>
  )
}

// ─── S2: Evolução do giro ─────────────────────────────────────────────────────

function SecaoGiroMensal() {
  const { data: giro } = useGiroAnual()

  return (
    <SectionCard
      icon={Activity}
      title="Evolução do giro"
      subtitle="Quantas vezes seu estoque inteiro foi vendido e reposto em cada mês do último ano."
      defaultOpen={false}
    >
      <div className="p-4 space-y-4">
        {giro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-medium">GIRO ANUAL</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-200">
                {fmtNum(giro.giro_reais)}
                <span className="text-base font-normal text-orange-700 dark:text-orange-400"> × ao ano</span>
              </p>
              <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-1">
                Quantas vezes seu estoque foi vendido e reposto nos últimos 12 meses
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-medium">ESTOQUE MÉDIO</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-200">{fmtBRL(giro.estoque_atual_reais)}</p>
              <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-1">
                Valor médio mantido em estoque ao longo do ano
              </p>
            </div>
          </div>
        )}
        <GiroMensalChart />
      </div>
    </SectionCard>
  )
}

// ─── S3: Performance por Fornecedor ──────────────────────────────────────────

function SecaoPerformanceFornecedor() {
  const { data = [], isLoading } = useEstoquePerformanceFornecedor()

  type Row = typeof data[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'nome',
      header: 'Fornecedor',
      cell: (r) => <span className="text-sm font-medium">{r.nome}</span>,
    },
    {
      key: 'lead_time',
      header: 'Lead time',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-gray-600 dark:text-muted-foreground">
          {r.lead_time_medio_dias !== null ? r.lead_time_medio_dias + 'd' : '—'}
        </span>
      ),
    },
    {
      key: 'entradas',
      header: 'Entradas 90d',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.total_entradas}</span>,
    },
    {
      key: 'valor_comprado',
      header: 'Valor comprado 90d',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtBRL(r.valor_total_comprado)}</span>,
    },
    {
      key: 'custo_medio',
      header: 'Custo unit. médio',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtBRL(r.custo_unitario_medio)}</span>,
    },
    {
      key: 'produtos',
      header: 'Produtos',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.produtos_fornecidos}</span>,
    },
  ]

  return (
    <SectionCard
      icon={Truck}
      title="Performance por fornecedor"
      subtitle="Quem te entrega mais, mais rápido e por que preço. Use pra negociar e priorizar."
      badge={isLoading ? undefined : { label: data.length + (data.length !== 1 ? ' fornecedores' : ' fornecedor'), variant: 'neutral' }}
      defaultOpen={false}
    >
      <EstoqueTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="Nenhum fornecedor ativo encontrado."
      />
    </SectionCard>
  )
}

// ─── S_NEW: Os mais rentáveis ─────────────────────────────────────────────────

type RentavelRow = CoberturaMargemRow & { lucro_unitario: number | null }

function SecaoMaisRentaveis() {
  const { data: rawRows = [], isLoading } = useMargemEstoque()

  const rows: RentavelRow[] = useMemo(() => {
    return rawRows
      .filter(r => r.margem_percentual !== null)
      .map(r => ({
        ...r,
        lucro_unitario:
          r.preco_venda != null && r.custo_medio != null
            ? r.preco_venda - r.custo_medio
            : null,
      }))
      .slice(0, 20)
  }, [rawRows])

  const columns: EstoqueTableColumn<RentavelRow>[] = [
    {
      key: 'produto',
      header: 'Produto',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{r.nome}</span>
          {r.sku && <span className="text-xs font-mono text-muted-foreground/60">{r.sku}</span>}
        </div>
      ),
    },
    {
      key: 'classe',
      header: 'ABC',
      align: 'center',
      cell: (r) => <ClasseABC classe={r.classe_abc} />,
    },
    {
      key: 'custo',
      header: 'Custo',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.custo_medio != null ? fmtBRL(r.custo_medio) : '—'}
        </span>
      ),
    },
    {
      key: 'preco',
      header: 'Preço venda',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums">
          {r.preco_venda != null ? fmtBRL(r.preco_venda) : '—'}
        </span>
      ),
    },
    {
      key: 'lucro',
      header: 'Lucro unit.',
      align: 'right',
      cell: (r) => {
        const l = r.lucro_unitario
        return (
          <span className={cn('tabular-nums font-medium', l != null && l < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400')}>
            {l != null ? fmtBRL(l) : '—'}
          </span>
        )
      },
    },
    {
      key: 'margem',
      header: 'Margem',
      align: 'right',
      cell: (r) => {
        const m = r.margem_percentual
        const cor = m == null ? '' : m < 0 ? 'text-red-600' : m < 20 ? 'text-amber-600' : 'text-green-700 dark:text-green-400'
        return (
          <span className={cn('tabular-nums font-semibold', cor)}>
            {m != null ? fmtNum(m, 1) + '%' : '—'}
          </span>
        )
      },
    },
  ]

  return (
    <SectionCard
      icon={TrendingUp}
      title="Os mais rentáveis"
      subtitle="Produtos com maior margem de contribuição — (preço − custo) ÷ preço. Top 20."
      badge={isLoading ? undefined : { label: `${rows.length} produtos`, variant: 'neutral' }}
      defaultOpen={false}
    >
      <EstoqueTable
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.produto_id}
        isLoading={isLoading}
        emptyMessage="Nenhum produto com preço e custo definidos."
      />
    </SectionCard>
  )
}

// ─── S4: Performance por Categoria ───────────────────────────────────────────

const PIE_COLORS = ['#E8701A', '#FB923C', '#FDBA74', '#FED7AA', '#FFF7ED']

function SecaoPerformanceCategoria() {
  const { data = [], isLoading } = useEstoquePerformanceCategoria()

  const totalVendido = data.reduce((s, r) => s + r.valor_vendido_90d, 0)
  const maxVendido = data.length > 0 ? Math.max(...data.map(r => r.valor_vendido_90d)) : 0

  const pieData = data.map((r) => ({
    name: r.categoria ?? 'Sem tipo',
    value: r.valor_vendido_90d,
  }))

  return (
    <SectionCard
      icon={Layers}
      title="Performance por categoria"
      subtitle="Quanto cada tipo de produto contribui pro faturamento. Tecidos vs ferragens vs acessórios."
      defaultOpen={false}
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-gray-100 dark:bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhum dado disponível.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [fmtBRL(value), 'Vendido 90d']}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-gray-200 dark:border-border">
                  <th className="text-center py-2 pr-3 font-medium">Categoria</th>
                  <th className="text-center py-2 px-2 font-medium">Produtos</th>
                  <th className="text-center py-2 px-2 font-medium">Em estoque</th>
                  <th className="text-center py-2 px-2 font-medium">Vendido 90d</th>
                  <th className="text-center py-2 pl-2 font-medium">% total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => {
                  const pct = totalVendido > 0
                    ? Math.round((r.valor_vendido_90d / totalVendido) * 100)
                    : 0
                  const isMax = r.valor_vendido_90d === maxVendido && maxVendido > 0
                  return (
                    <tr
                      key={r.categoria ?? i}
                      className="border-b border-gray-100 dark:border-border/50 last:border-0"
                    >
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="font-medium capitalize">{r.categoria ?? 'Sem tipo'}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2 tabular-nums text-gray-600 dark:text-muted-foreground">
                        {r.total_produtos}
                      </td>
                      <td className="text-center py-2 px-2 tabular-nums text-gray-600 dark:text-muted-foreground">
                        {r.valor_em_estoque !== null ? fmtBRL(r.valor_em_estoque) : '—'}
                      </td>
                      <td className="text-center py-2 px-2 tabular-nums">
                        {fmtBRL(r.valor_vendido_90d)}
                      </td>
                      <td className={cn(
                        'text-center py-2 pl-2 tabular-nums font-semibold',
                        isMax ? 'text-orange-700 dark:text-orange-400' : 'text-gray-500 dark:text-muted-foreground',
                      )}>
                        {pct}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── S5: Performance por Localização ─────────────────────────────────────────

function SecaoPerformanceLocalizacao() {
  const { data = [], isLoading } = useEstoquePerformanceLocalizacao()

  const avgVendido = data.length > 0
    ? data.reduce((s, r) => s + r.valor_vendido_90d, 0) / data.length
    : 0

  const isOportunidade = (r: { nivel_acesso: string | null; valor_vendido_90d: number }) =>
    (r.nivel_acesso === 'balcao' || r.nivel_acesso === 'acessivel') &&
    r.valor_vendido_90d < avgVendido &&
    avgVendido > 0

  type Row = typeof data[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'codigo',
      header: 'Local',
      cell: (r) => <span className="font-mono font-medium">{r.codigo}</span>,
    },
    {
      key: 'setor',
      header: 'Setor',
      cell: (r) => (
        <span className="text-gray-600 dark:text-muted-foreground capitalize">
          {r.setor ?? '—'}
        </span>
      ),
    },
    {
      key: 'nivel',
      header: 'Nível',
      cell: (r) => (
        <span className="inline-flex h-6 px-2 items-center rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 dark:bg-muted/20 dark:text-muted-foreground dark:border-border">
          {NIVEIS_ACESSO[r.nivel_acesso ?? ''] ?? r.nivel_acesso ?? '—'}
        </span>
      ),
    },
    {
      key: 'produtos',
      header: 'Produtos',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.total_produtos}</span>,
    },
    {
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-gray-600 dark:text-muted-foreground">
          {r.valor_em_estoque !== null ? fmtBRL(r.valor_em_estoque) : '—'}
        </span>
      ),
    },
    {
      key: 'vendido',
      header: 'Vendido 90d',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtBRL(r.valor_vendido_90d)}</span>,
    },
  ]

  const temOportunidade = data.some(isOportunidade)

  return (
    <SectionCard
      icon={MapPin}
      title="Performance por localização"
      subtitle="Quais lugares da loja geram mais vendas. Útil pra decidir reorganizações ou aproveitar pontos quentes."
      defaultOpen={false}
    >
      <EstoqueTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="Nenhuma localização ativa encontrada."
        rowClassName={(r) => isOportunidade(r) ? 'bg-amber-50/30 dark:bg-amber-950/10' : undefined}
        footerLeft={
          temOportunidade ? (
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700" />
              Locais visíveis com vendas abaixo da média — considere reorganizar
            </span>
          ) : undefined
        }
      />
    </SectionCard>
  )
}

// ─── S6: Sazonalidade ─────────────────────────────────────────────────────────

const MES_ABREV: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

function SecaoSazonalidade() {
  const { data = [], isLoading } = useEstoqueSazonalidade()

  const maxFaturamento = data.length > 0 ? Math.max(...data.map(r => r.faturamento)) : 0
  const minFaturamento = data.length > 0 ? Math.min(...data.map(r => r.faturamento)) : 0

  const mesPico = data.find(r => r.faturamento === maxFaturamento && maxFaturamento > 0)
  const mesFraco = data.length > 1 ? data.find(r => r.faturamento === minFaturamento) : undefined
  const variacao = minFaturamento > 0 ? maxFaturamento / minFaturamento : null

  const barColor = (fat: number) => {
    if (fat === maxFaturamento && maxFaturamento > 0) return '#C2570F'
    if (data.length > 1 && fat === minFaturamento) return '#FDBA74'
    return 'hsl(var(--primary))'
  }

  const chartData = data.map(r => ({
    mes: MES_ABREV[r.mes_numero] ?? String(r.mes_numero),
    faturamento: r.faturamento,
    fill: barColor(r.faturamento),
  }))

  type Row = typeof data[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'mes',
      header: 'Mês',
      cell: (r) => (
        <span className="font-medium">
          {MES_ABREV[r.mes_numero] ?? String(r.mes_numero)}/{r.ano}
        </span>
      ),
    },
    {
      key: 'vendas',
      header: 'Vendas',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.total_vendas}</span>,
    },
    {
      key: 'faturamento',
      header: 'Faturamento',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtBRL(r.faturamento)}</span>,
    },
    {
      key: 'ticket',
      header: 'Ticket médio',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-gray-600 dark:text-muted-foreground">
          {r.ticket_medio > 0 ? fmtBRL(r.ticket_medio) : '—'}
        </span>
      ),
    },
  ]

  return (
    <SectionCard
      icon={Calendar}
      title="Sazonalidade"
      subtitle="Como suas vendas variam mês a mês. Identifique meses fortes e fracos pra planejar compras e promoções."
      defaultOpen={false}
    >
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="h-64 rounded bg-gray-100 dark:bg-muted/30 animate-pulse" />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Nenhuma venda registrada nos últimos 12 meses.
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      new Intl.NumberFormat('pt-BR', {
                        notation: 'compact',
                        style: 'currency',
                        currency: 'BRL',
                        maximumFractionDigits: 0,
                      }).format(v)
                    }
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmtBRL(value), 'Faturamento']}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="faturamento" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {(mesPico || mesFraco) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {mesPico && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-medium">MÊS DE PICO</p>
                    <p className="text-base font-bold text-orange-900 dark:text-orange-200 mt-0.5">
                      {mesPico.mes_nome} {mesPico.ano}
                    </p>
                    <p className="text-xs text-orange-700/80 dark:text-orange-400/80">{fmtBRL(mesPico.faturamento)}</p>
                  </div>
                )}
                {mesFraco && mesFraco !== mesPico && (
                  <div className="bg-gray-50 dark:bg-muted/20 border border-gray-200 dark:border-border rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">MÊS MAIS FRACO</p>
                    <p className="text-base font-semibold text-foreground mt-0.5">
                      {mesFraco.mes_nome} {mesFraco.ano}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtBRL(mesFraco.faturamento)}</p>
                  </div>
                )}
                {variacao !== null && variacao > 1 && (
                  <div className="bg-gray-50 dark:bg-muted/20 border border-gray-200 dark:border-border rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">VARIAÇÃO</p>
                    <p className="text-base font-semibold text-foreground mt-0.5">{fmtNum(variacao, 1)}×</p>
                    <p className="text-xs text-muted-foreground">entre pico e vale</p>
                  </div>
                )}
              </div>
            )}

            <EstoqueTable
              columns={columns}
              data={data}
              keyExtractor={(r) => r.ano + '-' + r.mes_numero}
              isLoading={false}
            />
          </>
        )}
      </div>
    </SectionCard>
  )
}
