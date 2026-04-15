import { Package, DollarSign, Star, Clock, TrendingUp, Wallet } from 'lucide-react'
import MetricCard from './MetricCard'
import { CardTecidoParado } from './CardTecidoParado'
import CardSemLocalizacao from './CardSemLocalizacao'
import { CardGiro } from './CardGiro'
import { CardSugestoesCompra } from './CardSugestoesCompra'
import EstoqueAlertasPanel from '@/components/estoque/EstoqueAlertasPanel'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'
import { useROIEstoque } from '@/hooks/useEstoqueROI'
import { useCapitalTravado } from '@/hooks/useEstoqueCapitalTravado'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toast: (type: ToastType, message: string) => void
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  onMovimentar: (p: EstoqueProduto | EstoqueProdutoAlerta, tipo: 'entrada' | 'saida' | 'ajuste' | 'perda') => void
  onNavigateToLeadTime?: () => void
  onNavigateToAnalises?: () => void
  onNavigateToSugestao?: () => void
  onNavigateToLocalizacoes?: () => void
}

export default function EstoqueDashboard({
  toast: _toast,
  produtos,
  alertas,
  onMovimentar,
  onNavigateToLeadTime,
  onNavigateToAnalises,
  onNavigateToSugestao,
  onNavigateToLocalizacoes,
}: Props) {
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

  const { data: roi } = useROIEstoque()
  const { data: capitalTravado } = useCapitalTravado(90)

  const roiDisplay = roi
    ? `${roi.roi_percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    : '—'
  const capitalDisplay = capitalTravado
    ? fmtBRL(capitalTravado.total_capital_reais)
    : '—'

  return (
    <div className="space-y-4">

      {/* Linha 1 — 4 KPIs primários (ROI e Capital Travado em destaque) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Valor em estoque"
          value={fmtBRL(valorEmEstoque)}
          subtitle="custo médio × qtd"
          icon={DollarSign}
          variant="primary"
          valueColor="primary"
        />
        <MetricCard
          title="Produtos ativos"
          value={totalAtivos}
          subtitle="em estoque"
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="ROI Estoque"
          value={roiDisplay}
          subtitle="lucro anualizado / estoque"
          icon={TrendingUp}
          variant="primary"
          onClick={onNavigateToAnalises}
        />
        <MetricCard
          title="Capital Travado"
          value={capitalDisplay}
          subtitle="parado há 90+ dias"
          icon={Wallet}
          variant="primary"
          valueColor={capitalTravado && capitalTravado.total_capital_reais > 0 ? 'destructive' : undefined}
          onClick={onNavigateToAnalises}
        />
      </div>

      {/* Linha 2 — giro, sugestões e classificações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardGiro onClick={onNavigateToAnalises} />
        <CardSugestoesCompra onClick={onNavigateToSugestao} />
        <MetricCard
          title="Produtos classe A"
          value={classeACount}
          subtitle="top 80% do valor"
          icon={Star}
          variant="secondary"
          onClick={onNavigateToAnalises}
        />
        <MetricCard
          title="Sem venda 90 dias"
          value={semVenda90d}
          subtitle="sem classificação ABC"
          icon={Clock}
          variant="secondary"
          valueColor={semVenda90d > 0 ? 'destructive' : undefined}
          onClick={onNavigateToAnalises}
        />
      </div>

      {/* Linha 3 — contexto operacional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CardTecidoParado onClick={onNavigateToLeadTime} />
        <CardSemLocalizacao onClick={onNavigateToLocalizacoes} />
      </div>

      {/* Alertas de estoque mínimo — sempre abaixo dos cards */}
      {alertas.length > 0 && (
        <EstoqueAlertasPanel alertas={alertas} onMovimentar={onMovimentar} />
      )}

    </div>
  )
}
