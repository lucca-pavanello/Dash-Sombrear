import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShoppingCart, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useEstoqueProdutos } from '@/hooks/useEstoqueProdutos'
import { useVendas, useRegistrarVenda, useVendedores } from '@/hooks/useEstoqueVendas'
import DatePicker from '@/components/ui/DatePicker'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { tbl } from './shared/tableStyles'
import type { ToastType } from '@/hooks/useToast'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-orange-500 transition-all duration-150'
const labelClass =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600'

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  produto_id:     z.string().min(1, 'Selecione o produto'),
  quantidade:     z.number({ error: 'Valor inválido' }).min(0.001, 'Deve ser > 0'),
  preco_unitario: z.number({ error: 'Valor inválido' }).min(0, 'Deve ser ≥ 0'),
  desconto:       z.number({ error: 'Valor inválido' }).min(0, 'Deve ser ≥ 0').default(0),
})

const schema = z.object({
  cliente:    z.string().optional(),
  data:       z.string().min(1, 'Informe a data'),
  vendedor:   z.string().optional(),
  observacao: z.string().optional(),
  itens:      z.array(itemSchema).min(1, 'Adicione pelo menos 1 item'),
})

type FormData = z.infer<typeof schema>

function hoje() {
  return new Date().toISOString().split('T')[0]
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast:        (type: ToastType, message: string) => void
  responsavel:  string
  userId:       string | undefined
  onVerDetalhe: (id: string) => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function RegistroVendasView({ toast, responsavel, userId, onVerDetalhe }: Props) {
  const { data: produtos = [] } = useEstoqueProdutos()
  const { data: vendas = [], isLoading: loadingVendas } = useVendas()
  const { data: vendedores = [] } = useVendedores()
  const registrar = useRegistrarVenda()

  const produtoOptions = produtos.map((p) => ({
    value: p.id,
    label: p.codigo ? `${p.codigo} — ${p.nome}` : p.nome,
  }))

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      cliente:    '',
      data:       hoje(),
      vendedor:   responsavel,
      observacao: '',
      itens:      [{ produto_id: '', quantidade: undefined as unknown as number, preco_unitario: undefined as unknown as number, desconto: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const watchedItens = watch('itens')
  const dataValue = watch('data')

  // Autopreenchimento de preco_unitario ao selecionar produto
  function handleProdutoChange(index: number, produtoId: string) {
    const produto = produtos.find((p) => p.id === produtoId)
    if (produto?.preco_venda != null) {
      setValue(`itens.${index}.preco_unitario`, produto.preco_venda)
    }
  }

  function calcSubtotal(index: number): number {
    const item = watchedItens?.[index]
    if (!item) return 0
    const q = Number(item.quantidade) || 0
    const p = Number(item.preco_unitario) || 0
    const d = Number(item.desconto) || 0
    return Math.max(0, q * p - d)
  }

  const totalVenda = fields.reduce((acc, _, i) => acc + calcSubtotal(i), 0)

  const hasValidItem = watchedItens?.some(
    (item) =>
      item.produto_id &&
      Number(item.quantidade) > 0 &&
      Number(item.preco_unitario) >= 0
  )

  async function onSubmit(data: FormData) {
    try {
      const vendedorFinal = data.vendedor?.trim() || responsavel
      const vendaId = await registrar.mutateAsync({
        data:        data.data,
        cliente:     data.cliente,
        observacao:  data.observacao,
        vendedor:    vendedorFinal,
        vendedor_id: userId,
        itens:       data.itens,
      })

      const total = data.itens.reduce((acc, item) => {
        const sub = Math.max(0, item.quantidade * item.preco_unitario - (item.desconto ?? 0))
        return acc + sub
      }, 0)
      const totalFmt = formatCurrency(total)
      const nItens = data.itens.length

      toast('success', `Venda registrada: ${totalFmt} em ${nItens} item(s)`)
      reset({
        cliente:    '',
        data:       hoje(),
        vendedor:   responsavel,
        observacao: '',
        itens:      [{ produto_id: '', quantidade: undefined as unknown as number, preco_unitario: undefined as unknown as number, desconto: 0 }],
      })
      void vendaId
    } catch (err: any) {
      console.error('[RegistroVendasView]', err)
      toast('error', `Erro ao registrar venda: ${err?.message ?? 'erro desconhecido'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Parte 1 — Dados da venda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Cliente</label>
            <input
              type="text"
              {...register('cliente')}
              placeholder="Nome do cliente (opcional)"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Data *</label>
            <DatePicker
              value={dataValue}
              onChange={(v) => setValue('data', v, { shouldValidate: true })}
            />
            {errors.data && <p className="mt-1 text-xs text-destructive">{errors.data.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Vendedor</label>
            <input
              type="text"
              list="vendedores-list"
              {...register('vendedor')}
              placeholder={responsavel || 'Nome do vendedor'}
              className={inputClass}
            />
            <datalist id="vendedores-list">
              {vendedores.map((v) => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Observação</label>
            <input
              type="text"
              {...register('observacao')}
              placeholder="Opcional"
              className={inputClass}
            />
          </div>
        </div>

        {/* Separador */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Itens da venda</p>
            <button
              type="button"
              onClick={() => append({ produto_id: '', quantidade: undefined as unknown as number, preco_unitario: undefined as unknown as number, desconto: 0 })}
              className="flex items-center gap-1 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item
            </button>
          </div>

          {/* Cabeçalho da tabela (sm+) */}
          <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 mb-1 px-1">
            {['Produto', 'Quantidade', 'Preço unit. (R$)', 'Desconto (R$)', 'Subtotal', ''].map((h) => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</span>
            ))}
          </div>

          <div className="space-y-2">
            {fields.map((field, index) => {
              const sub = calcSubtotal(index)
              return (
                <div
                  key={field.id}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-start rounded-lg bg-muted/30 p-2"
                >
                  {/* Produto */}
                  <div>
                    <label className="sm:hidden block mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Produto</label>
                    <CustomSelect
                      value={watchedItens[index]?.produto_id ?? ''}
                      onChange={(v) => {
                        setValue(`itens.${index}.produto_id`, v, { shouldValidate: true })
                        handleProdutoChange(index, v)
                      }}
                      options={produtoOptions}
                      placeholder="Selecione o produto..."
                    />
                    {errors.itens?.[index]?.produto_id && (
                      <p className="mt-0.5 text-xs text-destructive">{errors.itens[index].produto_id?.message}</p>
                    )}
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="sm:hidden block mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quantidade</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="0"
                      {...register(`itens.${index}.quantidade`, { valueAsNumber: true })}
                      className={cn(inputClass, 'py-2 text-right', errors.itens?.[index]?.quantidade && 'border-destructive')}
                    />
                    {errors.itens?.[index]?.quantidade && (
                      <p className="mt-0.5 text-xs text-destructive">{errors.itens[index].quantidade?.message}</p>
                    )}
                  </div>

                  {/* Preço unitário */}
                  <div>
                    <label className="sm:hidden block mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preço unit.</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      {...register(`itens.${index}.preco_unitario`, { valueAsNumber: true })}
                      className={cn(inputClass, 'py-2 text-right', errors.itens?.[index]?.preco_unitario && 'border-destructive')}
                    />
                  </div>

                  {/* Desconto */}
                  <div>
                    <label className="sm:hidden block mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Desconto</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      {...register(`itens.${index}.desconto`, { valueAsNumber: true })}
                      className={cn(inputClass, 'py-2 text-right')}
                    />
                  </div>

                  {/* Subtotal (readonly) */}
                  <div>
                    <label className="sm:hidden block mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Subtotal</label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(sub)}
                      className={cn(inputClass, 'py-2 bg-muted/40 cursor-default text-right font-semibold text-orange-700')}
                    />
                  </div>

                  {/* Remover */}
                  <div className="flex items-start pt-2 sm:pt-0 sm:justify-center">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {errors.itens?.root && (
            <p className="mt-1 text-xs text-destructive">{errors.itens.root.message}</p>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Total da venda</span>
          <span className="text-xl font-bold text-orange-700">{formatCurrency(totalVenda)}</span>
        </div>

        {/* Submit */}
        <div className="flex">
          <button
            type="submit"
            disabled={!hasValidItem || registrar.isPending}
            className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            <ShoppingCart className="h-4 w-4" />
            {registrar.isPending ? 'Registrando...' : 'Registrar venda'}
          </button>
        </div>
      </form>

      {/* Histórico */}
      <div className={tbl.container}>
        <div className="px-5 py-3 border-b">
          <p className="text-sm font-semibold">Histórico de vendas</p>
          <p className="text-xs text-muted-foreground">Últimas 50 vendas registradas</p>
        </div>

        {loadingVendas ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : vendas.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tbl.theadRow}>
                  <th className={tbl.th}>Data</th>
                  <th className={tbl.th}>Cliente</th>
                  <th className={tbl.th}>Vendedor</th>
                  <th className={cn(tbl.th, 'text-right')}>Nº itens</th>
                  <th className={cn(tbl.th, 'text-right border-r-0')}>Total</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr
                    key={venda.id}
                    onClick={() => onVerDetalhe(venda.id)}
                    className={cn(tbl.tbodyRow, 'cursor-pointer')}
                  >
                    <td className={cn(tbl.td, 'whitespace-nowrap')}>
                      {new Date(venda.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className={tbl.td}>
                      {venda.cliente || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className={tbl.td}>
                      {(venda.vendedor || venda.vendedor_nome) || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className={cn(tbl.td, 'text-right')}>{venda.num_itens}</td>
                    <td className={cn(tbl.td, 'text-right font-semibold text-orange-700 whitespace-nowrap border-r-0')}>
                      {formatCurrency(venda.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={tbl.tfootRow}>
                  <td colSpan={5} className={tbl.tfootCell}>
                    Total — {vendas.length} {vendas.length === 1 ? 'venda' : 'vendas'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
