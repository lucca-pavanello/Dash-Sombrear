import { cn } from '@/lib/utils'

const CLASSE_CONFIG = {
  A: { dot: 'bg-orange-400', text: 'text-gray-700 font-medium' },
  B: { dot: 'bg-gray-400',   text: 'text-gray-600' },
  C: { dot: 'bg-gray-300',   text: 'text-gray-500' },
} as const

interface ClasseABCProps {
  classe: 'A' | 'B' | 'C' | 'sem_dados' | string | null
  className?: string
}

export function ClasseABC({ classe, className }: ClasseABCProps) {
  if (!classe || classe === 'sem_dados') {
    return <span className={cn('text-gray-400 text-xs italic', className)}>Sem dados</span>
  }

  const config = CLASSE_CONFIG[classe as keyof typeof CLASSE_CONFIG]
  if (!config) {
    return <span className={cn('text-gray-400 text-xs italic', className)}>{classe}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', config.dot)} />
      <span className={cn('text-sm', config.text)}>{classe}</span>
    </span>
  )
}
