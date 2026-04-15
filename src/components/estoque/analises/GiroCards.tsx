import { DollarSign, TrendingUp, RefreshCw, Package } from 'lucide-react'
import KpiCard from '@/components/shared/KpiCard'
import { useGiroAnual } from '@/hooks/useEstoqueAnalytics'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

export default function GiroCards() {
  const { data: giro, isLoading } = useGiroAnual()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Valor em estoque',
      value: giro ? fmtBRL(giro.estoque_atual_reais) : 'R$ 0,00',
      subtitle: 'custo médio × qtd',
      icon: <DollarSign className="h-4 w-4" />,
      variant: 'default' as const,
    },
    {
      title: 'Giro anual R$',
      value: giro ? `${fmtNum(giro.giro_reais)}×` : '0,00×',
      subtitle: 'vezes ao ano',
      icon: <TrendingUp className="h-4 w-4" />,
      variant: 'amber' as const,
    },
    {
      title: 'Giro anual un.',
      value: giro ? `${fmtNum(giro.giro_unidades)}×` : '0,00×',
      subtitle: 'vezes ao ano',
      icon: <RefreshCw className="h-4 w-4" />,
      variant: 'orange' as const,
    },
    {
      title: 'Estoque (un.)',
      value: giro ? fmtNum(giro.estoque_atual_unidades) : '0',
      subtitle: 'unidades ativas',
      icon: <Package className="h-4 w-4" />,
      variant: 'default' as const,
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
