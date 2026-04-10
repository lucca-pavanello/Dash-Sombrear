import { Package, AlertTriangle, DollarSign, ArrowLeftRight } from 'lucide-react'
import KpiCard, { type KpiVariant } from '@/components/shared/KpiCard'
import { formatCompact } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import type { EstoqueProduto, EstoqueProdutoAlerta, EstoqueMovimentacao } from '@/lib/supabase'

interface Props {
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  movimentacoesHoje: EstoqueMovimentacao[]
}

export default function EstoqueKPIGrid({ produtos, alertas, movimentacoesHoje }: Props) {
  const totalProdutos = produtos.length
  const totalAlertas = alertas.length
  const totalMovs = movimentacoesHoje.length
  const valorEmEstoque = produtos.reduce((s, p) => {
    return s + (p.quantidade_atual ?? 0) * (p.custo_unitario ?? 0)
  }, 0)

  const animProdutos = useCountUp(totalProdutos, 700)
  const animAlertas  = useCountUp(totalAlertas,  600)
  const animValor    = useCountUp(valorEmEstoque, 900)
  const animMovs     = useCountUp(totalMovs,      650)

  const cards = [
    {
      title: 'Produtos Ativos',
      value: Math.round(animProdutos),
      icon: <Package className="h-4 w-4" />,
      subtitle: 'em estoque',
      variant: 'default' as const,
    },
    {
      title: 'Alertas de Estoque',
      value: Math.round(animAlertas),
      icon: <AlertTriangle className="h-4 w-4" />,
      subtitle: totalAlertas === 0 ? 'tudo em ordem' : `${totalAlertas} abaixo do mínimo`,
      variant: (totalAlertas > 0 ? 'amber' : 'default') as KpiVariant,
    },
    {
      title: 'Valor em Estoque',
      value: formatCompact(animValor),
      icon: <DollarSign className="h-4 w-4" />,
      subtitle: 'custo estimado',
      variant: 'blue' as const,
    },
    {
      title: 'Movimentações Hoje',
      value: Math.round(animMovs),
      icon: <ArrowLeftRight className="h-4 w-4" />,
      subtitle: 'entradas e saídas',
      variant: 'orange' as const,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <div
          key={card.title}
          className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
        >
          <KpiCard {...card} />
        </div>
      ))}
    </div>
  )
}
