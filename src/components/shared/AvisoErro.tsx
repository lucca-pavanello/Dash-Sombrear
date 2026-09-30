import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

/**
 * Falhou a leitura: uma frase em português e o botão de tentar de novo.
 *
 * Mesma peça do `AvisoErro` da TECPAV e do Garimpo. Existe porque, sem ela, cada aba
 * tratava erro de um jeito, e a maioria nem tratava: a consulta falhava e a tela dizia
 * "Nenhum dado neste período", que é mentira. A frase vem de quem chama, nunca o
 * `error.message` cru do banco.
 */
export default function AvisoErro({ mensagem, aoTentar, className }: {
  mensagem: string
  aoTentar?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn(
      'flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-center',
      className,
    )}>
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-destructive">{mensagem}</p>
      {aoTentar && <Button variant="outline" size="sm" onClick={aoTentar}>Tentar de novo</Button>}
    </div>
  )
}
