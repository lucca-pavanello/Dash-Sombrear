import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueConfig, useSalvarConfig } from '@/hooks/useEstoqueConfig'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { ToastType } from '@/hooks/useToast'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  verde_max: z
    .number({ error: 'Informe um número' })
    .int('Deve ser inteiro')
    .positive('Deve ser > 0'),
  amarelo_max: z
    .number({ error: 'Informe um número' })
    .int('Deve ser inteiro')
    .positive('Deve ser > 0'),
  custo_pedido: z
    .number({ error: 'Informe um número' })
    .positive('Deve ser > 0'),
  taxa_estocagem: z
    .number({ error: 'Informe um número' })
    .int('Deve ser inteiro')
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100'),
  meses_historico: z
    .number({ error: 'Informe um número' })
    .int('Deve ser inteiro')
    .min(1, 'Mínimo 1')
    .max(36, 'Máximo 36'),
}).refine((d) => d.amarelo_max > d.verde_max, {
  message: 'O máximo amarelo deve ser maior que o verde',
  path: ['amarelo_max'],
})

type FormData = z.infer<typeof schema>

// ─── Seções (extensível para Fase 4) ─────────────────────────────────────────

type ConfigSection = {
  title: string
  description?: string
  fields: {
    key: string
    label: string
    formField: keyof FormData
    step?: number
    min?: number
    helpText?: string
  }[]
}

const SECTIONS: ConfigSection[] = [
  {
    title: 'Lead Time',
    description:
      'Verde é saudável (produto girando). Entre verde e amarelo é alerta. Acima do amarelo é crítico.',
    fields: [
      {
        key: 'lead_time_verde_max_dias',
        label: 'Lead time verde máximo (dias)',
        formField: 'verde_max',
      },
      {
        key: 'lead_time_amarelo_max_dias',
        label: 'Lead time amarelo máximo (dias)',
        formField: 'amarelo_max',
      },
    ],
  },
  {
    title: 'Parâmetros de Compra',
    description: 'Usados no cálculo do Lote Econômico de Compra (LEC) para sugestões de reposição.',
    fields: [
      {
        key: 'custo_pedido_reais',
        label: 'Custo médio de emitir um pedido (R$)',
        formField: 'custo_pedido',
        step: 0.01,
        min: 0.01,
        helpText: 'Inclui tempo administrativo, frete fixo, etc. Afeta o tamanho do LEC.',
      },
      {
        key: 'taxa_custo_estocagem_percent',
        label: 'Taxa anual de custo de estocagem (%)',
        formField: 'taxa_estocagem',
        step: 1,
        min: 0,
        helpText: 'Percentual do custo unitário por ano (armazenagem, capital parado). Ex: 20.',
      },
      {
        key: 'meses_historico_demanda',
        label: 'Meses de histórico para demanda',
        formField: 'meses_historico',
        step: 1,
        min: 1,
        helpText: 'Janela de vendas passadas usada para estimar a demanda anual. Ex: 12.',
      },
    ],
  },
]

// ─── Mapa: formField → chave do banco ────────────────────────────────────────

const FIELD_TO_KEY: Record<keyof FormData, string> = {
  verde_max:       'lead_time_verde_max_dias',
  amarelo_max:     'lead_time_amarelo_max_dias',
  custo_pedido:    'custo_pedido_reais',
  taxa_estocagem:  'taxa_custo_estocagem_percent',
  meses_historico: 'meses_historico_demanda',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const inputErrorClass = 'border-red-400 focus:border-red-500'

export default function ConfiguracaoView({ toast }: Props) {
  const { data: config, isLoading } = useEstoqueConfig()
  const salvar = useSalvarConfig()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Popula o form quando os dados chegam do banco
  useEffect(() => {
    if (!config) return
    reset({
      verde_max:       parseInt(config['lead_time_verde_max_dias']      ?? '90',  10),
      amarelo_max:     parseInt(config['lead_time_amarelo_max_dias']     ?? '180', 10),
      custo_pedido:    parseFloat(config['custo_pedido_reais']           ?? '50'),
      taxa_estocagem:  parseInt(config['taxa_custo_estocagem_percent']   ?? '20',  10),
      meses_historico: parseInt(config['meses_historico_demanda']        ?? '12',  10),
    })
  }, [config, reset])

  async function onSubmit(data: FormData) {
    const rows = (Object.keys(data) as (keyof FormData)[]).map((field) => ({
      chave: FIELD_TO_KEY[field],
      valor: String(data[field]),
    }))

    try {
      await salvar.mutateAsync(rows)
      toast('success', 'Configurações salvas')
    } catch {
      toast('error', 'Erro ao salvar configurações')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-display text-base font-semibold">Configurações do Estoque</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ajuste os parâmetros de alertas e cálculos do módulo.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border bg-card shadow-sm p-5 space-y-4"
          >
            {/* Cabeçalho da seção */}
            <div>
              <h4 className="text-sm font-semibold">
                {section.title === 'Lead Time' ? (
                  <InfoTooltip label="Lead Time" tip="Tempo médio que o produto fica parado em estoque entre a compra e a venda. Quanto maior, mais dinheiro empatado." />
                ) : section.title === 'Parâmetros de Compra' ? (
                  <InfoTooltip label="Parâmetros de Compra" tip="Usados no cálculo do LEC (Lote Econômico de Compra). Afetam as sugestões de reposição." />
                ) : section.title}
              </h4>
              {section.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
              )}
            </div>

            {/* Campos */}
            <div className="grid sm:grid-cols-2 gap-4">
              {section.fields.map((field) => {
                const err = errors[field.formField]
                return (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      {field.label}
                    </label>
                    <input
                      type="number"
                      min={field.min ?? 1}
                      step={field.step ?? 1}
                      disabled={isLoading}
                      {...register(field.formField, { valueAsNumber: true })}
                      className={cn(inputClass, err && inputErrorClass)}
                    />
                    {field.helpText && (
                      <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                    )}
                    {err && (
                      <p className="text-xs text-red-500">{err.message}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Botão salvar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || isLoading || salvar.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isSubmitting || salvar.isPending ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
