import { ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useVendaDetalhe } from '@/hooks/useEstoqueVendas'

interface Props {
  vendaId: string
  onVoltar: () => void
}

export default function VendaDetalheView({ vendaId, onVoltar }: Props) {
  const { data: venda, isLoading, error } = useVendaDetalhe(vendaId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (error || !venda) {
    return (
      <div className="space-y-4">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <p className="text-sm text-destructive">Venda não encontrada.</p>
      </div>
    )
  }

  const shortId = venda.id.slice(0, 8).toUpperCase()

  return (
    <div className="space-y-5">
      {/* Botão Voltar */}
      <button
        onClick={onVoltar}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para vendas
      </button>

      {/* Header */}
      <div>
        <h3 className="font-display text-base font-semibold">Venda #{shortId}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Detalhes do registro de venda</p>
      </div>

      {/* Dados da venda */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Dados gerais</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Data</p>
            <p className="text-sm font-medium">
              {new Date(venda.data + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Cliente</p>
            <p className="text-sm font-medium">{venda.cliente || <span className="italic text-muted-foreground/60">—</span>}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Vendedor</p>
            <p className="text-sm font-medium">{venda.vendedor_nome || <span className="italic text-muted-foreground/60">—</span>}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Observação</p>
            <p className="text-sm font-medium">{venda.observacao || <span className="italic text-muted-foreground/60">—</span>}</p>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b">
          <p className="text-sm font-semibold">Itens</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['Produto', 'Quantidade', 'Preço unitário', 'Desconto', 'Subtotal'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venda.estoque_venda_itens.map((item) => {
                const nomeProduto = item.estoque_produtos
                  ? item.estoque_produtos.nome
                  : item.produto_id.slice(0, 8)
                const unidade = item.estoque_produtos?.unidade ?? ''
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{nomeProduto}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      {unidade ? ` ${unidade}` : ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(item.preco_unitario)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.desconto ? formatCurrency(item.desconto) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Total no rodapé */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
          <span className="text-sm font-semibold text-muted-foreground">Total</span>
          <span className="font-display text-xl font-bold text-primary">{formatCurrency(venda.total)}</span>
        </div>
      </div>
    </div>
  )
}
