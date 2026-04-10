import { Package, AlertTriangle, DollarSign, ArrowLeftRight } from 'lucide-react'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency } from '@/lib/utils'
import type { EstoqueProduto, EstoqueProdutoAlerta, EstoqueMovimentacao } from '@/lib/supabase'

interface Props {
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  movimentacoesHoje: EstoqueMovimentacao[]
}

export default function EstoqueKPIGrid({ produtos, alertas, movimentacoesHoje }: Props) {
  const totalProdutos = produtos.length

  const valorEmEstoque = produtos.reduce((s, p) => {
    return s + (p.quantidade_atual ?? 0) * (p.custo_unitario ?? 0)
  }, 0)

  const totalAlertas = alertas.length

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        title="Produtos Ativos"
        value={totalProdutos}
        icon={<Package className="h-4 w-4" />}
        subtitle="em estoque"
        variant="default"
      />
      <KpiCard
        title="Alertas de Estoque"
        value={totalAlertas}
        icon={<AlertTriangle className="h-4 w-4" />}
        subtitle={totalAlertas === 0 ? 'tudo em ordem' : `${totalAlertas} abaixo do mínimo`}
        variant={totalAlertas > 0 ? 'amber' : 'default'}
      />
      <KpiCard
        title="Valor em Estoque"
        value={formatCurrency(valorEmEstoque)}
        icon={<DollarSign className="h-4 w-4" />}
        subtitle="custo estimado"
        variant="blue"
      />
      <KpiCard
        title="Movimentações Hoje"
        value={movimentacoesHoje.length}
        icon={<ArrowLeftRight className="h-4 w-4" />}
        subtitle="entradas e saídas"
        variant="orange"
      />
    </div>
  )
}
