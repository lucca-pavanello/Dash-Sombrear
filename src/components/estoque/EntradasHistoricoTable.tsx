import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <div className="border-b px-5 py-3">
        <h3 className="font-semibold text-sm">Histórico de Entradas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Últimas 50 entradas registradas</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '700px' }}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quantidade</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Custo unit.</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Custo total</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Nota fiscal</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Fornecedor</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma entrada registrada ainda.
                </td>
              </tr>
            ) : (
              itens.map((item) => {
                const lote = item.estoque_lotes
                const produto = item.estoque_produtos
                const custo_total = item.quantidade * item.custo_unitario
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
                      {lote?.data_entrada ? formatDate(lote.data_entrada) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{produto?.nome ?? '—'}</span>
                      {produto?.unidade && (
                        <span className="ml-1 text-xs text-muted-foreground uppercase">({produto.unidade})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {item.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap hidden md:table-cell text-muted-foreground">
                      {formatCurrency(item.custo_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-primary">
                      {formatCurrency(custo_total)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {lote?.nf_numero ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {lote?.estoque_fornecedores?.nome ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
