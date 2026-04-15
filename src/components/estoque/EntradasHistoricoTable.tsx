import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { tbl } from '@/components/estoque/shared/tableStyles'

type HistoricoItem = {
  id: string
  created_at: string
  quantidade: number
  custo_unitario: number
  estoque_lotes: {
    nf_numero: string | null
    data_entrada: string
    estoque_fornecedores: { nome: string } | null
  } | null
  estoque_produtos: { nome: string; unidade: string } | null
}

function useEntradasHistorico() {
  return useQuery({
    queryKey: ['estoque-entradas-historico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_lote_itens')
        .select(`
          id, created_at, quantidade, custo_unitario,
          estoque_lotes(nf_numero, data_entrada, estoque_fornecedores(nome)),
          estoque_produtos(nome, unidade)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as HistoricoItem[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export default function EntradasHistoricoTable() {
  const { data: itens = [], isLoading } = useEntradasHistorico()

  return (
    <div className={tbl.container}>
      {/* Header do card */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-base font-semibold text-foreground">Histórico de Entradas</p>
        <p className="text-xs text-muted-foreground mt-0.5">Últimas 50 entradas registradas</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: '700px' }}>
          <thead>
            <tr className={tbl.theadRow}>
              <th className={`${tbl.th} text-center`}>Data</th>
              <th className={`${tbl.th} text-center`}>Produto</th>
              <th className={`${tbl.th} text-center`}>Quantidade</th>
              <th className={`${tbl.th} text-center hidden md:table-cell`}>Custo unit.</th>
              <th className={`${tbl.th} text-center`}>Custo total</th>
              <th className={`${tbl.th} text-center hidden lg:table-cell`}>Nota fiscal</th>
              <th className={`${tbl.th} text-center hidden lg:table-cell`}>Fornecedor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className={tbl.tbodyRow}>
                  <td className={tbl.td}><div className="h-4 w-20 bg-muted rounded animate-pulse" /></td>
                  <td className={tbl.td}><div className="h-4 w-32 bg-muted rounded animate-pulse" /></td>
                  <td className={tbl.td}><div className="h-4 w-14 bg-muted rounded animate-pulse ml-auto" /></td>
                  <td className={`${tbl.td} hidden md:table-cell`}><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto" /></td>
                  <td className={tbl.td}><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto" /></td>
                  <td className={`${tbl.td} hidden lg:table-cell`}><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                  <td className={`${tbl.td} hidden lg:table-cell`}><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                </tr>
              ))
            ) : itens.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Inbox className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma entrada registrada ainda</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Registre a primeira entrada no formulário acima</p>
                </td>
              </tr>
            ) : (
              itens.map((item) => {
                const lote = item.estoque_lotes
                const produto = item.estoque_produtos
                const custo_total = item.quantidade * item.custo_unitario
                return (
                  <tr key={item.id} className={tbl.tbodyRow}>
                    <td className={`${tbl.td} whitespace-nowrap text-muted-foreground`}>
                      {lote?.data_entrada ? formatDate(lote.data_entrada) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={tbl.td}>
                      <span className="font-medium">{produto?.nome ?? <span className="text-muted-foreground/40">—</span>}</span>
                      {produto?.unidade && (
                        <span className="ml-1 text-xs text-muted-foreground uppercase">({produto.unidade})</span>
                      )}
                    </td>
                    <td className={`${tbl.td} text-center whitespace-nowrap font-semibold`}>
                      {item.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      {produto?.unidade && (
                        <span className="ml-1 text-xs text-muted-foreground">{produto.unidade}</span>
                      )}
                    </td>
                    <td className={`${tbl.td} text-center whitespace-nowrap text-muted-foreground hidden md:table-cell`}>
                      {formatCurrency(item.custo_unitario)}
                    </td>
                    <td className={`${tbl.td} text-center whitespace-nowrap font-semibold text-primary`}>
                      {formatCurrency(custo_total)}
                    </td>
                    <td className={`${tbl.td} text-muted-foreground hidden lg:table-cell`}>
                      {lote?.nf_numero ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={`${tbl.td} text-muted-foreground hidden lg:table-cell`}>
                      {lote?.estoque_fornecedores?.nome ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {!isLoading && itens.length > 0 && (
            <tfoot>
              <tr className={tbl.tfootRow}>
                <td colSpan={7} className={`${tbl.tfootCell} text-center`}>
                  TOTAL — {itens.length} {itens.length === 1 ? 'entrada' : 'entradas'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
