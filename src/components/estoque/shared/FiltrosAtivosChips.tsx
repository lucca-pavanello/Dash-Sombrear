import { X } from 'lucide-react'

interface FiltrosAtivosChipsProps {
  filtros: Record<string, string[]>
  labels: Record<string, string>
  formatLabel?: Record<string, (v: string) => string>
  onRemove: (colKey: string, value: string) => void
  onClearAll: () => void
}

export function FiltrosAtivosChips({
  filtros,
  labels,
  formatLabel,
  onRemove,
  onClearAll,
}: FiltrosAtivosChipsProps) {
  const active = Object.entries(filtros).filter(([, vals]) => vals.length > 0)
  if (active.length === 0) return null

  const totalValues = active.reduce((sum, [, vals]) => sum + vals.length, 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
      <span className="text-xs text-muted-foreground shrink-0">Filtros:</span>
      {active.flatMap(([colKey, vals]) =>
        vals.map(v => (
          <span
            key={`${colKey}-${v}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium"
          >
            <span className="text-muted-foreground/80">{labels[colKey]}:</span>
            <span className="text-primary">{formatLabel?.[colKey]?.(v) ?? v}</span>
            <button
              onClick={() => onRemove(colKey, v)}
              className="ml-0.5 rounded-full p-0.5 text-primary/60 hover:text-primary hover:bg-primary/20 transition-colors"
              title="Remover filtro"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        )),
      )}
      {totalValues > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors"
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}
