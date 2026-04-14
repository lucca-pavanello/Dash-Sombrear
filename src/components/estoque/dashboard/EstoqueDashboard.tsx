import { Package, DollarSign, Star, Clock } from 'lucide-react'
import MetricCard from './MetricCard'
import { CardTecidoParado } from './CardTecidoParado'
import CardSemLocalizacao from './CardSemLocalizacao'
import ParetoChart from './ParetoChart'
import TopAClassTable from './TopAClassTable'
import RecalcularABCButton from './RecalcularABCButton'
import EstoqueAlertasPanel from '@/components/estoque/EstoqueAlertasPanel'
import { useParetoData } from '@/hooks/useEstoqueAnalytics'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  toast: (type: ToastType, message: string) => void
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  onMovimentar: (p: EstoqueProduto | EstoqueProdutoAlerta, tipo: 'entrada' | 'saida' | 'ajuste' | 'perda') => void
  onNavigateToLeadTime?: () => void
}

export default function EstoqueDashboard({ toast, produtos, alertas, onMovimentar, onNavigateToLeadTime }: Props) {
  const { data: paretoData, isLoading: loadingPareto } = useParetoData()

  // ── Métricas dos 4 cards ──────────────────────────────────────
  const ativos = produtos.filter((p) => p.ativo)
  const totalAtivos = ativos.length
  const valorEmEstoque = ativos.reduce(
    (s, p) => s + (p.quantidade_atual ?? 0) * (p.custo_unitario ?? 0),
    0,
  )
  const classeACount = produtos.filter((p) => p.classificacao_abc === 'A').length
  const semVenda90d = produtos.filter(
    (p) => p.classificacao_abc === 'sem_dados' && p.ativo,
  ).length

  const hasEnoughData = (paretoData?.totalVendas ?? 0) >= 5

  return (
    <div className="space-y-5">
      {/* Seção 1 — 6 Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricCard
          title="Produtos ativos"
          value={totalAtivos}
          subtitle="em estoque"
          icon={Package}
          accent="default"
        />
        <MetricCard
          title="Valor em estoque"
          value={fmtBRL(valorEmEstoque)}
          subtitle="custo médio × qtd"
          icon={DollarSign}
          accent="blue"
        />
        <MetricCard
          title="Produtos classe A"
          value={classeACount}
          subtitle="top 80% do valor"
          icon={Star}
          accent="emerald"
        />
        <MetricCard
          title="Sem venda 90 dias"
          value={semVenda90d}
          subtitle="requerem atenção"
          icon={Clock}
          accent={semVenda90d > 0 ? 'amber' : 'default'}
        />
        <CardTecidoParado onClick={onNavigateToLeadTime} />
        <CardSemLocalizacao />
      </div>

      {/* Alertas de estoque mínimo */}
      {alertas.length > 0 && (
        <EstoqueAlertasPanel alertas={alertas} onMovimentar={onMovimentar} />
      )}

      {/* Seção 2 — Gráfico Pareto + Botão Recalcular */}
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Curva ABC — Top 20 produtos (últimos 90 dias)</p>
            <p className="text-xs text-muted-foreground">
              Classificação por valor monetário vendido · Pareto 80/15/5
            </p>
          </div>
          <RecalcularABCButton toast={toast} />
        </div>

        {/* Legenda de cores */}
        <div className="flex items-center gap-4 border-b px-4 py-2">
          {[
            { cls: 'A', color: '#22c55e', label: 'Classe A' },
            { cls: 'B', color: '#eab308', label: 'Classe B' },
            { cls: 'C', color: '#94a3b8', label: 'Classe C' },
            { cls: 'sem_dados', color: '#cbd5e1', label: 'Sem dados' },
          ].map(({ cls, color, label }) => (
            <div key={cls} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="h-0.5 w-5 rounded-full bg-orange-500" />
            <span className="text-[11px] text-muted-foreground">% acumulado</span>
          </div>
        </div>

        <div className="p-4">
          {!hasEnoughData && !loadingPareto ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center px-6">
              <p className="text-sm font-medium text-muted-foreground">
                Ainda não há vendas suficientes para calcular a Curva ABC.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Registre pelo menos 5 vendas e clique em "Recalcular Curva ABC".
              </p>
            </div>
          ) : (
            <ParetoChart items={paretoData?.items ?? []} isLoading={loadingPareto} />
          )}
        </div>
      </div>

      {/* Seção 3 — Tabela Top Classe A */}
      {(hasEnoughData || loadingPareto) && (
        <TopAClassTable items={paretoData?.items ?? []} isLoading={loadingPareto} />
      )}
    </div>
  )
}
