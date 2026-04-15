import {
  ShoppingBag, Clock, BarChart2,
  ArrowLeftRight, AlertTriangle, Activity,
  CircleCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
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
import SectionCard from './shared/SectionCard'
import EstoqueTable, { type EstoqueTableColumn } from './shared/EstoqueTable'
import { ClasseABC } from './shared/ClasseABC'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { ToastType } from '@/hooks/useToast'
import type { NivelAlerta } from './theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)


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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
  onDrillDown: (tab: 'lead-time' | 'mover' | 'sugestao' | 'ponto-pedido') => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalisesUnificadas({ toast, onDrillDown }: Props) {
  return (
    <div className="space-y-6">
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
  const totalEstimado = naoOk.reduce((s, r) => s + r.custo_estimado, 0)
  const top10 = naoOk.slice(0, 10)

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
    <SectionCard
      icon={ShoppingBag}
      title="O que comprar agora"
      subtitle={isLoading ? 'Carregando...' : naoOk.length === 0 ? 'Nenhum produto precisa de reposição agora.' : `${naoOk.length} precisam de reposição · ${fmtBRL(totalEstimado)} estimado`}
      badge={isLoading ? undefined : naoOk.length > 0
        ? { label: `${naoOk.length} produto${naoOk.length !== 1 ? 's' : ''}`, variant: 'info' }
        : { label: 'Tudo abastecido', variant: 'neutral' }
      }
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
    </SectionCard>
  )
}

// ─── S2: Ponto de Pedido ──────────────────────────────────────────────────────

function SecaoPontoPedido({ onVerTodos }: { onVerTodos: () => void }) {
  const { data = [], isLoading } = useEstoquePontoPedido()
  const alertas = data.filter(r => r.nivel_alerta !== 'ok' && r.nivel_alerta !== 'sem_dados')
  const rupturas = alertas.filter(r => r.nivel_alerta === 'ruptura').length
  const criticos = alertas.filter(r => r.nivel_alerta === 'critico').length
  const top10 = alertas.slice(0, 10)

  const badge = isLoading ? undefined :
    rupturas > 0 ? { label: `${rupturas} em ruptura`, variant: 'urgent' as const } :
    criticos > 0 ? { label: `${criticos} crítico${criticos !== 1 ? 's' : ''}`, variant: 'urgent' as const } :
    alertas.length > 0 ? { label: `${alertas.length} em alerta`, variant: 'warning' as const } :
    { label: 'Tudo ok', variant: 'neutral' as const }

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
      cell: (r) => <ClasseABC classe={r.classe_abc} />,
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
    <SectionCard
      icon={AlertTriangle}
      title="Quando comprar"
      subtitle="Produtos que já passaram do ponto de pedido. Se não comprar agora, vai faltar antes da entrega chegar."
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
    </SectionCard>
  )
}

// ─── S3: Lead Time ────────────────────────────────────────────────────────────

function SecaoLeadTime({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: rows = [], isLoading } = useLeadTimeRows()
  const comEstoque = rows.filter(r => r.quantidade_atual > 0)
  const top10 = comEstoque.slice(0, 10)
  const valorTotal = rows.reduce((s, r) => s + Number(r.valor_parado_reais ?? 0), 0)

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
      cell: (r) => <ClasseABC classe={r.classificacao_abc} />,
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
    <SectionCard
      icon={Clock}
      title="O que está parado"
      subtitle="Produtos sentados no estoque há muito tempo. Cada dia parado é dinheiro empatado."
      badge={isLoading ? undefined : { label: `${formatCurrency(valorTotal)} parado`, variant: 'warning' }}
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
    </SectionCard>
  )
}

// ─── S4: Curva ABC / Pareto ───────────────────────────────────────────────────

function SecaoCurvaAbc({ toast }: { toast: (type: ToastType, message: string) => void }) {
  const { data: paretoData, isLoading } = useParetoData()
  const hasData = (paretoData?.totalVendas ?? 0) >= 5

  return (
    <SectionCard
      icon={BarChart2}
      title="O que mais vende"
      subtitle="Curva ABC: 20% dos produtos geram 80% do faturamento. Estes são os que importam."
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
    </SectionCard>
  )
}

// ─── S5: Reorganizar ─────────────────────────────────────────────────────────

function SecaoReorganizar({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: sugestoes = [], isLoading } = useEstoqueSugestoesMover()
  const top10 = sugestoes.slice(0, 10)

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
      cell: (r) => <ClasseABC classe={r.classe_abc} />,
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
    <SectionCard
      icon={ArrowLeftRight}
      title="Como reorganizar a loja"
      subtitle="Sugestões pra deixar os produtos mais vendidos perto do balcão e os menos vendidos no fundo."
      badge={isLoading ? undefined : sugestoes.length > 0
        ? { label: `${sugestoes.length} ${sugestoes.length === 1 ? 'sugestão' : 'sugestões'}`, variant: 'info' }
        : undefined
      }
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
        footerLeft={`${sugestoes.length} ${sugestoes.length === 1 ? 'sugestão' : 'sugestões'}`}
        footerRight={
          <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
            Ver todos →
          </button>
        }
      />
    </SectionCard>
  )
}

// ─── S6: Giro Mensal ─────────────────────────────────────────────────────────

function SecaoGiroMensal() {
  const { data: giro } = useGiroAnual()

  const fmtGiro = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  return (
    <SectionCard
      icon={Activity}
      title="Evolução do giro"
      subtitle="Quantas vezes seu estoque inteiro foi vendido e reposto em cada mês do último ano."
    >
      <div className="p-4 space-y-4">
        {giro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-orange-600 font-medium">GIRO ANUAL</p>
              <p className="text-3xl font-bold text-orange-900">
                {fmtGiro(giro.giro_reais)}
                <span className="text-base font-normal text-orange-700"> × ao ano</span>
              </p>
              <p className="text-xs text-orange-700/80 mt-1">
                Quantas vezes seu estoque foi vendido e reposto nos últimos 12 meses
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-orange-600 font-medium">ESTOQUE MÉDIO</p>
              <p className="text-3xl font-bold text-orange-900">{fmtBRL(giro.estoque_atual_reais)}</p>
              <p className="text-xs text-orange-700/80 mt-1">
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
