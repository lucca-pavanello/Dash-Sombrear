import type { ParetoItem } from '@/hooks/useEstoqueAnalytics'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  items: ParetoItem[]
  isLoading: boolean
}

export default function TopAClassTable({ items, isLoading }: Props) {
  const classAItems = items.filter((p) => p.classificacao_abc === 'A').slice(0, 20)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Top Produtos — Classe A</p>
        <p className="text-xs text-muted-foreground">
          Produtos que concentram ~80% do valor vendido nos últimos 90 dias
        </p>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      ) : classAItems.length === 0 ? (
        <div className="flex items-center justify-center h-28 text-center px-4">
          <p className="text-sm text-muted-foreground">
            Nenhum produto classificado como Classe A ainda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Valor vendido 90d</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">% do total</th>
              </tr>
            </thead>
            <tbody>
              {classAItems.map((item, i) => (
                <tr key={item.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{item.codigo}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[160px] truncate" title={item.nome}>
                    {item.nome}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtBRL(item.valor_total)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {item.percentual_individual.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
