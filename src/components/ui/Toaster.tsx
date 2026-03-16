import { CheckCircle2, XCircle, Info, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Toast } from '@/hooks/useToast'

interface Props {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export default function Toaster({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'relative flex items-center gap-3 rounded-xl border px-4 py-3 shadow-elevated text-sm font-medium overflow-hidden',
            'animate-in slide-in-from-bottom-4 fade-in duration-200',
            t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
              : t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
          )}
        >
          {/* Ícone por tipo */}
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            : t.type === 'error'
            ? <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            : <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          }

          <span className="flex-1 leading-snug">{t.message}</span>

          {/* Botão de desfazer (opcional) */}
          {t.undoAction && (
            <button
              onClick={() => { t.undoAction!(); onDismiss(t.id) }}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Desfazer
            </button>
          )}

          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Barra de progresso */}
          <div
            className={cn(
              'absolute bottom-0 left-0 h-0.5 rounded-full',
              t.type === 'success' ? 'bg-green-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500',
            )}
            style={{ animation: `toast-shrink ${t.duration}ms linear forwards` }}
          />
        </div>
      ))}
    </div>
  )
}
