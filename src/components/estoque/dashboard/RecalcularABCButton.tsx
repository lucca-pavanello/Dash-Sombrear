import { RefreshCw } from 'lucide-react'
import { useRecalcularAbcV2 } from '@/hooks/useEstoqueAnalytics'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function RecalcularABCButton({ toast }: Props) {
  const recalcular = useRecalcularAbcV2()

  async function handleClick() {
    try {
      const result = await recalcular.mutateAsync()
      if (result) {
        toast(
          'success',
          `Classificação concluída: ${result.classe_a} classe A, ${result.classe_b} classe B, ${result.classe_c} classe C`,
        )
      } else {
        toast('success', 'Curva ABC recalculada com sucesso.')
      }
    } catch {
      toast('error', 'Erro ao recalcular curva ABC.')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={recalcular.isPending}
      className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${recalcular.isPending ? 'animate-spin' : ''}`} />
      {recalcular.isPending ? 'Calculando…' : 'Recalcular Curva ABC'}
    </button>
  )
}
