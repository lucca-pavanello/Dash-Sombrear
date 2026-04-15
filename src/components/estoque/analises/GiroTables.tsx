import { useTopMelhorGiro, useTopPiorGiro } from '@/hooks/useEstoqueAnalytics'
import { ClasseABC } from '../shared/ClasseABC'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)


function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
      ))}
    </div>
  )
}

function MelhorGiroTable() {
  const { data: items = [], isLoading } = useTopMelhorGiro(10)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Top 10 — Melhor Giro</p>
        <p className="text-xs text-muted-foreground">Mais vendidos nos últimos 90 dias</p>
      </div>
      {isLoading ? <TableSkeleton /> : items.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground px-4">
          Sem vendas nos últimos 90 dias.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground w-7">#</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">SKU</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">Nome</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground">Classe</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Vendas 90d</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.codigo}</td>
                  <td className="px-3 py-2 max-w-[120px] truncate text-xs font-medium" title={item.nome}>{item.nome}</td>
                  <td className="px-3 py-2 text-center"><ClasseABC classe={item.classificacao_abc} /></td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">{fmtBRL(item.valor_vendido_90d)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtNum(item.quantidade_atual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PiorGiroTable() {
  const { data: items = [], isLoading } = useTopPiorGiro(10)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Top 10 — Pior Giro</p>
        <p className="text-xs text-muted-foreground">Maior valor parado em estoque</p>
      </div>
      {isLoading ? <TableSkeleton /> : items.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground px-4">
          Todos os produtos têm bom giro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground w-7">#</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">SKU</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">Nome</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground">Classe</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Dias s/ vender</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Estoque</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Valor parado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.codigo}</td>
                  <td className="px-3 py-2 max-w-[110px] truncate text-xs font-medium" title={item.nome}>{item.nome}</td>
                  <td className="px-3 py-2 text-center"><ClasseABC classe={item.classificacao_abc} /></td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {item.dias_sem_vender !== null
                      ? <span className={item.dias_sem_vender > 60 ? 'text-muted-foreground font-semibold' : ''}>{item.dias_sem_vender}d</span>
                      : <span className="text-muted-foreground/60">nunca</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtNum(item.quantidade_atual)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-medium text-foreground">{fmtBRL(item.valor_parado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function GiroTables() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MelhorGiroTable />
      <PiorGiroTable />
    </div>
  )
}
