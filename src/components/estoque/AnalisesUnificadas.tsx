import { useState } from 'react'
import {
  ChevronDown, ChevronRight, ShoppingBag, Clock, BarChart2,
  ArrowLeftRight, TrendingUp, AlertTriangle,
  CircleCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useSugestaoCompra } from '@/hooks/useEstoqueSugestao'
import { useEstoquePontoPedido } from '@/hooks/useEstoquePontoPedido'
import { useLeadTimeRows } from '@/hooks/useEstoqueLeadTime'
import { useEstoqueSugestoesMover } from '@/hooks/useEstoqueSugestoesMover'
import { useParetoData, useGiroAnual } from '@/hooks/useEstoqueAnalytics'
import { NIVEIS_ACESSO } from '@/lib/constants'
import ParetoChart from './dashboard/ParetoChart'
import TopAClassTable from './dashboard/TopAClassTable'
import RecalcularABCButton from './dashboard/RecalcularABCButton'
import GiroMensalChart from './analises/GiroMensalChart'
import EstoqueTable, { type EstoqueTableColumn } from './shared/EstoqueTable'
import type { ToastType } from '@/hooks/useToast'
import type { NivelAlerta } from './theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

function AbcBadge({ cls }: { cls: string | null }) {
  const c = cls ?? 'sem_dados'
  const colorMap: Record<string, string> = {
    A:         'bg-orange-100 text-orange-800',
    B:         'bg-gray-800 text-white',
    C:         'bg-gray-200 text-gray-700',
    sem_dados: 'bg-gray-50 text-gray-400 italic border border-gray-200',
  }
  const isSemDados = c === 'sem_dados'
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-full text-[11px] font-bold',
      isSemDados ? 'h-6 px-2' : 'h-6 w-6',
      colorMap[c] ?? colorMap.sem_dados,
    )}>
      {isSemDados ? '—' : c}
    </span>
  )
}

function NivelBadge({ nivel }: { nivel: NivelAlerta }) {
  const colorMap: Record<string, string> = {
    ruptura:   'bg-red-50 text-red-700 border border-red-200',
    critico:   'bg-red-50 text-red-700 border border-red-200',
    atencao:   'bg-amber-50 text-amber-700 border border-amber-200',
    ok:        'bg-gray-50 text-gray-500 border border-gray-200',
    sem_dados: 'bg-gray-50 text-gray-400 border border-gray-200',
  }
  const labels: Record<string, string> = {
    ruptura: 'Ruptura', critico: 'Crítico', atencao: 'Atenção', ok: 'OK', sem_dados: '—',
  }
  return (
    <span className={cn(
      'inline-flex h-6 px-2 items-center rounded-full text-xs font-medium',
      colorMap[nivel] ?? colorMap.sem_dados,
    )}>
      {labels[nivel] ?? nivel}
    </span>
  )
}

// ─── Seção collapsável ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
  onDrillDown: (tab: 'lead-time' | 'mover' | 'sugestao' | 'ponto-pedido') => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalisesUnificadas({ toast, onDrillDown }: Props) {
  return (
    <div className="space-y-4">
      {/* Header da página */}
      <div>
        <h3 className="font-display text-base font-semibold">Análises de Estoque</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          O sistema olha seus dados e te diz o que fazer. Veja abaixo o que ele descobriu.
        </p>
      </div>

      {/* S1 — O que comprar agora */}
      <SecaoSugestaoCompra onVerTodos={() => onDrillDown('sugestao')} />

      {/* S2 — Quando comprar */}
      <SecaoPontoPedido onVerTodos={() => onDrillDown('ponto-pedido')} />

      {/* S3 — O que está parado */}
      <SecaoLeadTime onVerTodos={() => onDrillDown('lead-time')} />

      {/* S4 — O que mais vende */}
      <SecaoCurvaAbc toast={toast} />

      {/* S5 — Como reorganizar */}
      <SecaoReorganizar onVerTodos={() => onDrillDown('mover')} />

      {/* S6 — Evolução do giro */}
      <SecaoGiroMensal />
    </div>
  )
}

// ─── S1: Sugestão de Compra ───────────────────────────────────────────────────

const urgencyColor: Record<string, string> = {
  critico:       'bg-red-50 text-red-700 border border-red-200',
  abaixo_minimo: 'bg-orange-50 text-orange-700 border border-orange-200',
  atencao:       'bg-amber-50 text-amber-700 border border-amber-200',
  ok:            'bg-gray-50 text-gray-500 border border-gray-200',
}
const urgencyLabel: Record<string, string> = {
  critico: 'Crítico', abaixo_minimo: 'Ab. mínimo', atencao: 'Atenção', ok: 'OK',
}

function SecaoSugestaoCompra({ onVerTodos }: { onVerTodos: () => void }) {
  const { data = [], isLoading } = useSugestaoCompra()
  const naoOk = data.filter(r => r.urgencia !== 'ok')
  const criticos = data.filter(r => r.urgencia === 'critico').length
  const totalEstimado = naoOk.reduce((s, r) => s + r.custo_estimado, 0)
  const top10 = naoOk.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      criticos > 0 ? 'bg-destructive/10 text-destructive' : naoOk.length > 0 ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground',
    )}>
      {naoOk.length === 0 ? 'Tudo OK' : `${naoOk.length} produto${naoOk.length !== 1 ? 's' : ''}`}
    </span>
  )

  type Row = typeof top10[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'urgencia',
      header: 'Urgência',
      cell: (r) => (
        <span className={cn(
          'inline-flex h-6 px-2 items-center rounded-full text-xs font-medium',
          urgencyColor[r.urgencia] ?? urgencyColor.ok,
        )}>
          {urgencyLabel[r.urgencia] ?? r.urgencia}
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (r) => <span className="font-mono text-gray-500">{r.codigo ?? '—'}</span>,
    },
    {
      key: 'nome',
      header: 'Nome',
      className: 'max-w-[140px]',
      cell: (r) => <span className="block truncate font-medium">{r.nome}</span>,
    },
    {
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtNum(r.quantidade_atual)}</span>,
    },
    {
      key: 'lec',
      header: <InfoTooltip label="LEC" tip="Lote Econômico de Compra. Quantidade ideal a comprar de cada vez pra gastar menos com pedidos e armazenagem. Calculado pelo sistema com base nas vendas dos últimos 12 meses." />,
      align: 'right',
      cell: (r) => <span className="tabular-nums font-medium text-primary">{fmtNum(r.lec_sugerido)}</span>,
    },
    {
      key: 'fornecedor',
      header: 'Fornecedor',
      className: 'max-w-[120px]',
      cell: (r) => <span className="block truncate text-gray-500">{r.fornecedor_nome ?? '—'}</span>,
    },
  ]

  return (
    <Section
      icon={<ShoppingBag className="h-4 w-4" />}
      title={<InfoTooltip label="O que comprar agora" tip="Os produtos mais importantes que estão acabando e precisam de reposição." />}
      subtitle={isLoading ? 'Carregando...' : naoOk.length === 0 ? 'Nenhum produto precisa de reposição agora.' : `${naoOk.length} precisam de reposição · ${fmtBRL(totalEstimado)} estimado`}
      badge={badge}
      defaultOpen
    >
      <EstoqueTable
        columns={columns}
        data={top10}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage={
          <span className="flex items-center justify-center gap-2">
            <CircleCheck className="h-4 w-4" />
            Nenhum produto abaixo do ideal.
          </span>
        }
        footerLeft={`${data.length} produtos classe A analisados`}
        footerRight={
          <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
            Ver todos →
          </button>
        }
      />
    </Section>
  )
}

// ─── S2: Ponto de Pedido ──────────────────────────────────────────────────────

function SecaoPontoPedido({ onVerTodos }: { onVerTodos: () => void }) {
  const { data = [], isLoading } = useEstoquePontoPedido()
  const alertas = data.filter(r => r.nivel_alerta !== 'ok' && r.nivel_alerta !== 'sem_dados')
  const rupturas = alertas.filter(r => r.nivel_alerta === 'ruptura').length
  const top10 = alertas.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      rupturas > 0 ? 'bg-destructive/10 text-destructive' : alertas.length > 0 ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground',
    )}>
      {alertas.length === 0 ? 'Tudo OK' : `${alertas.length} produto${alertas.length !== 1 ? 's' : ''}`}
    </span>
  )

  type Row = typeof top10[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'alerta',
      header: 'Alerta',
      cell: (r) => <NivelBadge nivel={r.nivel_alerta} />,
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (r) => <span className="font-mono text-gray-500">{r.sku ?? '—'}</span>,
    },
    {
      key: 'nome',
      header: 'Nome',
      className: 'max-w-[140px]',
      cell: (r) => <span className="block truncate font-medium">{r.nome}</span>,
    },
    {
      key: 'classe',
      header: 'Classe',
      align: 'center',
      cell: (r) => <AbcBadge cls={r.classe_abc} />,
    },
    {
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtNum(r.estoque_atual)}</span>,
    },
    {
      key: 'ponto_pedido',
      header: <InfoTooltip label="Ponto de Pedido" tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se esperar mais, o produto vai faltar antes do pedido chegar." />,
      align: 'right',
      cell: (r) => <span className="tabular-nums">{fmtNum(r.ponto_pedido)}</span>,
    },
    {
      key: 'cobertura',
      header: 'Cobertura',
      align: 'right',
      cell: (r) =>
        r.cobertura_dias > 0
          ? <span className="tabular-nums text-gray-500">{r.cobertura_dias}d</span>
          : <span className="text-red-700 font-semibold">Ruptura</span>,
    },
  ]

  return (
    <Section
      icon={<AlertTriangle className="h-4 w-4" />}
      title={<InfoTooltip label="Quando comprar" tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se você esperar mais, vai faltar produto antes do pedido chegar." />}
      subtitle={isLoading ? 'Carregando...' : alertas.length === 0 ? 'Nenhum produto abaixo do ponto de pedido.' : `${alertas.length} produto${alertas.length !== 1 ? 's' : ''} abaixo do ponto de pedido`}
      badge={badge}
      defaultOpen
    >
      <EstoqueTable
        columns={columns}
        data={top10}
        keyExtractor={(r) => r.produto_id}
        isLoading={isLoading}
        emptyMessage={
          <span className="flex items-center justify-center gap-2">
            <CircleCheck className="h-4 w-4" />
            Todos os produtos estão acima do ponto de pedido.
          </span>
        }
        footerLeft={`${data.length} produtos analisados`}
        footerRight={
          <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
            Ver todos →
          </button>
        }
      />
    </Section>
  )
}

// ─── S3: Lead Time ────────────────────────────────────────────────────────────

function SecaoLeadTime({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: rows = [], isLoading } = useLeadTimeRows()
  const comEstoque = rows.filter(r => r.quantidade_atual > 0)
  const top10 = comEstoque.slice(0, 10)
  const valorTotal = rows.reduce((s, r) => s + Number(r.valor_parado_reais ?? 0), 0)

  const badge = isLoading ? null : (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
      {formatCurrency(valorTotal)} parado
    </span>
  )

  type Row = typeof top10[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'nome',
      header: 'Nome',
      className: 'max-w-[180px]',
      cell: (r) => <span className="block truncate font-medium">{r.nome}</span>,
    },
    {
      key: 'classe',
      header: 'Classe',
      align: 'center',
      cell: (r) => <AbcBadge cls={r.classificacao_abc} />,
    },
    {
      key: 'dias',
      header: 'Dias parado',
      align: 'right',
      cell: (r) => {
        const dias = r.dias_em_estoque ?? 0
        const cls = dias > 180
          ? 'text-red-700 font-semibold'
          : dias > 90
            ? 'text-gray-900 font-semibold'
            : 'text-gray-500'
        return (
          <span className={cn('tabular-nums', cls)}>
            {r.dias_em_estoque !== null ? `${r.dias_em_estoque}d` : '—'}
          </span>
        )
      },
    },
    {
      key: 'valor',
      header: 'Valor parado',
      align: 'right',
      cell: (r) =>
        r.valor_parado_reais !== null
          ? <span className="tabular-nums">{formatCurrency(Number(r.valor_parado_reais))}</span>
          : <span className="text-gray-400">—</span>,
    },
  ]

  return (
    <Section
      icon={<Clock className="h-4 w-4" />}
      title={<InfoTooltip label="O que está parado" tip="Tempo médio que o produto fica parado em estoque entre comprar e vender. Quanto maior, mais dinheiro empatado." />}
      subtitle="Produtos sentados há mais tempo no estoque. Cada dia parado é dinheiro empatado."
      badge={badge}
    >
      <EstoqueTable
        columns={columns}
        data={top10}
        keyExtractor={(r) => r.produto_id}
        isLoading={isLoading}
        emptyMessage="Nenhum produto com estoque ativo."
        footerLeft={`${comEstoque.length} produtos com estoque`}
        footerRight={
          <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
            Ver todos →
          </button>
        }
      />
    </Section>
  )
}

// ─── S4: Curva ABC / Pareto ───────────────────────────────────────────────────

function SecaoCurvaAbc({ toast }: { toast: (type: ToastType, message: string) => void }) {
  const { data: paretoData, isLoading } = useParetoData()
  const hasData = (paretoData?.totalVendas ?? 0) >= 5

  return (
    <Section
      icon={<BarChart2 className="h-4 w-4" />}
      title={<InfoTooltip label="O que mais vende" tip="Classifica produtos pelo quanto geram de receita. Classe A = 20% dos produtos que dão 80% do dinheiro. Princípio de Pareto." />}
      subtitle="Os produtos que mais geram dinheiro pra você. Foco neles."
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Curva ABC — Top 20 produtos (últimos 90 dias)</p>
          <RecalcularABCButton toast={toast} />
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
    </Section>
  )
}

// ─── S5: Reorganizar ─────────────────────────────────────────────────────────

function SecaoReorganizar({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: sugestoes = [], isLoading } = useEstoqueSugestoesMover()
  const top10 = sugestoes.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      sugestoes.length > 0 ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground',
    )}>
      {sugestoes.length === 0 ? 'Tudo OK' : `${sugestoes.length} sugestão${sugestoes.length !== 1 ? 'ões' : ''}`}
    </span>
  )

  type Row = typeof top10[number]
  const columns: EstoqueTableColumn<Row>[] = [
    {
      key: 'nome',
      header: 'Nome',
      className: 'max-w-[140px]',
      cell: (r) => <span className="block truncate font-medium">{r.nome}</span>,
    },
    {
      key: 'classe',
      header: 'Classe',
      align: 'center',
      cell: (r) => <AbcBadge cls={r.classe_abc} />,
    },
    {
      key: 'local_atual',
      header: 'Local atual',
      cell: (r) => (
        <span className="text-gray-700">
          {NIVEIS_ACESSO[r.nivel_atual] ?? r.nivel_atual}
        </span>
      ),
    },
    {
      key: 'sugestao',
      header: 'Sugestão',
      cell: (r) => {
        const translated = r.nivel_sugerido
          .split(' ou ')
          .map((part: string) => NIVEIS_ACESSO[part.trim()] ?? part.trim())
          .join(' ou ')
        return <span className="font-medium text-gray-900">{translated}</span>
      },
    },
  ]

  return (
    <Section
      icon={<ArrowLeftRight className="h-4 w-4" />}
      title="Como reorganizar a loja"
      subtitle="Sugestões pra deixar os produtos mais vendidos perto do balcão."
      badge={badge}
    >
      <EstoqueTable
        columns={columns}
        data={top10}
        keyExtractor={(r) => r.produto_id}
        isLoading={isLoading}
        emptyMessage={
          <span className="flex items-center justify-center gap-2">
            <CircleCheck className="h-4 w-4" />
            Todos os produtos estão bem alocados.
          </span>
        }
        footerLeft={`${sugestoes.length} sugestão${sugestoes.length !== 1 ? 'ões' : ''}`}
        footerRight={
          <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
            Ver todos →
          </button>
        }
      />
    </Section>
  )
}

// ─── S6: Giro Mensal ─────────────────────────────────────────────────────────

function SecaoGiroMensal() {
  const { data: giro } = useGiroAnual()

  const fmtGiro = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  return (
    <Section
      icon={<TrendingUp className="h-4 w-4" />}
      title={<InfoTooltip label="Evolução do giro" tip="Quantas vezes seu estoque inteiro é vendido e reposto num ano. Giro 6 = você 'troca' o estoque 6× por ano. Quanto maior, melhor." />}
      subtitle="Quantas vezes seu estoque girou em cada mês do último ano."
    >
      <div className="p-4 space-y-3">
        {giro && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              <InfoTooltip label="Giro anual" tip="Quantas vezes seu estoque inteiro é vendido e reposto num ano. Giro 6 = você 'troca' o estoque 6× por ano. Quanto maior, melhor." />
              {': '}
              <strong className="text-foreground">{fmtGiro(giro.giro_reais)}×</strong>
            </span>
            <span>
              <InfoTooltip label="Estoque médio" tip="Quanto produto, em média, você tem parado no estoque ao longo do ano. Quanto menor, mais eficiente é seu capital." />
              {': '}
              <strong className="text-foreground">{fmtBRL(giro.estoque_atual_reais)}</strong>
            </span>
          </div>
        )}
        <GiroMensalChart />
      </div>
    </Section>
  )
}
