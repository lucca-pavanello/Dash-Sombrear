import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PackagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { INPUT_CLASSES, LABEL_CLASS } from './shared/inputStyles'
import { useEstoqueProdutos } from '@/hooks/useEstoqueProdutos'
import { useEstoqueFornecedores } from '@/hooks/useEstoqueFornecedores'
import { useAddLote } from '@/hooks/useEstoqueLotes'
import type { ToastType } from '@/hooks/useToast'

const labelClass = LABEL_CLASS

const schema = z.object({
  produto_id:     z.string().min(1, 'Selecione o produto'),
  data_entrada:   z.string().min(1, 'Informe a data'),
  quantidade:     z.number({ error: 'Valor inválido' }).min(0.001, 'Deve ser > 0'),
  custo_unitario: z.number({ error: 'Valor inválido' }).min(0, 'Deve ser ≥ 0'),
  nota_fiscal:    z.string().optional(),
  fornecedor_id:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

function hoje() {
  return new Date().toISOString().split('T')[0]
}

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function EntradaRapidaForm({ toast }: Props) {
  const { data: produtos = [] } = useEstoqueProdutos()
  const { data: fornecedores = [] } = useEstoqueFornecedores()
  const addLote = useAddLote()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData, unknown, FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      produto_id:     '',
      data_entrada:   hoje(),
      quantidade:     undefined,
      custo_unitario: undefined,
      nota_fiscal:    '',
      fornecedor_id:  '',
    },
  })

  const produtoId = watch('produto_id')
  const fornecedorId = watch('fornecedor_id')
  const dataEntrada = watch('data_entrada')

  const [tipoUnidade, setTipoUnidade] = useState<'unidade' | 'metro'>('unidade')

  const produtoOptions = produtos.map((p) => ({
    value: p.id,
    label: p.codigo ? `${p.codigo} — ${p.nome}` : p.nome,
  }))

  const fornecedorOptions = [
    { value: '', label: '— Nenhum —' },
    ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
  ]

  // Auto-preenche fornecedor ao selecionar produto
  useEffect(() => {
    if (!produtoId) return
    const produto = produtos.find((p) => p.id === produtoId)
    if (!produto?.fornecedor) return
    const match = fornecedores.find((f) => f.nome === produto.fornecedor)
    if (match) setValue('fornecedor_id', match.id)
  }, [produtoId, produtos, fornecedores, setValue])

  async function onSubmit(data: FormData) {
    const produto = produtos.find((p) => p.id === data.produto_id)
    try {
      await addLote.mutateAsync({
        fornecedor_id: data.fornecedor_id || null,
        nf_numero:     data.nota_fiscal?.trim() || null,
        data_entrada:  data.data_entrada,
        itens: [{
          produto_id:     data.produto_id,
          quantidade:     data.quantidade,
          custo_unitario: data.custo_unitario,
        }],
      })
      const qtdFmt = data.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
      const unidadeLabel = tipoUnidade === 'metro' ? 'metros' : 'unidades'
      toast('success', `Entrada registrada: ${qtdFmt} ${unidadeLabel} de ${produto?.nome ?? 'produto'}`)
      reset({ produto_id: '', data_entrada: hoje(), quantidade: undefined, custo_unitario: undefined, nota_fiscal: '', fornecedor_id: '' })
      setTipoUnidade('unidade')
    } catch (err) {
      console.error('[EntradaRapidaForm]', err)
      toast('error', 'Erro ao registrar entrada.')
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-border bg-card shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <PackagePlus className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Registrar Entrada</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Produto + Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Produto <span className="text-orange-500 ml-0.5">*</span>
            </label>
            <CustomSelect
              value={produtoId ?? ''}
              onChange={(v) => setValue('produto_id', v, { shouldValidate: true })}
              options={produtoOptions}
              placeholder="Selecione o produto..."
              className={cn(INPUT_CLASSES, "!font-normal")}
            />
            {errors.produto_id && <p className="mt-1 text-xs text-red-600">{errors.produto_id.message}</p>}
          </div>
          <div>
            <label className={labelClass}>
              Data de entrada <span className="text-orange-500 ml-0.5">*</span>
            </label>
            <DatePicker
              value={dataEntrada ?? ''}
              onChange={(v) => setValue('data_entrada', v, { shouldValidate: true })}
              triggerClassName={cn(INPUT_CLASSES, errors.data_entrada && '!border-red-400')}
            />
            {errors.data_entrada && <p className="mt-1 text-xs text-red-600">{errors.data_entrada.message}</p>}
          </div>
        </div>

        {/* Tipo de unidade */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
            {(['unidade', 'metro'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoUnidade(tipo)}
                className={cn(
                  'px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-150',
                  tipoUnidade === tipo
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tipo === 'unidade' ? 'Unidade' : 'Metro'}
              </button>
            ))}
          </div>
        </div>

        {/* Quantidade + Custo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              {tipoUnidade === 'unidade' ? 'Quantidade' : 'Metragem (m)'} <span className="text-orange-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              {...register('quantidade', { valueAsNumber: true })}
              placeholder={tipoUnidade === 'unidade' ? 'Ex: 50' : 'Ex: 10,5'}
              className={cn(INPUT_CLASSES, errors.quantidade && '!border-red-400 focus:!border-red-500 focus:!ring-red-200')}
            />
            {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade.message}</p>}
          </div>
          <div>
            <label className={labelClass}>
              {tipoUnidade === 'unidade' ? 'Custo unitário (R$)' : 'Custo por metro (R$)'} <span className="text-orange-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('custo_unitario', { valueAsNumber: true })}
              placeholder="Ex: 40,00"
              className={cn(INPUT_CLASSES, errors.custo_unitario && '!border-red-400 focus:!border-red-500 focus:!ring-red-200')}
            />
            {errors.custo_unitario && <p className="mt-1 text-xs text-red-600">{errors.custo_unitario.message}</p>}
          </div>
        </div>

        {/* Nota fiscal + Fornecedor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nota fiscal</label>
            <input
              type="text"
              {...register('nota_fiscal')}
              placeholder="Ex: NF-123456"
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label className={labelClass}>Fornecedor</label>
            <CustomSelect
              value={fornecedorId ?? ''}
              onChange={(v) => setValue('fornecedor_id', v, { shouldValidate: true })}
              options={fornecedorOptions}
              placeholder="— Nenhum —"
              className={cn(INPUT_CLASSES, "!font-normal")}
            />
          </div>
        </div>

        <div className="flex justify-center mt-6">
          <button
            type="submit"
            disabled={addLote.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-gradient h-11 px-8 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {addLote.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
              : <><PackagePlus className="h-4 w-4" /> Registrar entrada</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
