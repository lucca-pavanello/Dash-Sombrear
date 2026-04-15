import { BarChart2, Activity } from 'lucide-react'
import { useParetoData, useGiroAnual } from '@/hooks/useEstoqueAnalytics'
import ParetoChart from './dashboard/ParetoChart'
import TopAClassTable from './dashboard/TopAClassTable'
import RecalcularABCButton from './dashboard/RecalcularABCButton'
import GiroMensalChart from './analises/GiroMensalChart'
import SectionCard from './shared/SectionCard'
import type { ToastType } from '@/hooks/useToast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtGiro = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalisesView({ toast }: Props) {
  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div>
        <h3 className="font-display text-base font-semibold">Análises de Estoque</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Entenda como seu estoque está performando. Vendas, giros e tendências dos últimos meses.
        </p>
      </div>

      {/* S4 — O que mais vende */}
      <SecaoCurvaAbc toast={toast} />

      {/* S6 — Evolução do giro */}
      <SecaoGiroMensal />
    </div>
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

// ─── S6: Giro Mensal ─────────────────────────────────────────────────────────

function SecaoGiroMensal() {
  const { data: giro } = useGiroAnual()

  return (
    <SectionCard
      icon={Activity}
      title="Evolução do giro"
      subtitle="Quantas vezes seu estoque inteiro foi vendido e reposto em cada mês do último ano."
    >
      <div className="p-4 space-y-4">
        {giro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-medium">GIRO ANUAL</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-200">
                {fmtGiro(giro.giro_reais)}
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
