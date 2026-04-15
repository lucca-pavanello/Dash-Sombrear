import { X } from 'lucide-react'
import type { RangeState } from './FilterPopover'

interface FiltrosAtivosChipsProps {
  filtros: Record<string, unknown>
  filterTypes: Record<string, 'multi' | 'range' | 'text'>
  labels: Record<string, string>
  formatLabel?: Record<string, (v: string) => string>
  /** value presente = remoção de item individual em multi; ausente = limpa o filtro inteiro */
  onRemove: (colKey: string, value?: string) => void
  onClearAll: () => void
}

function rangeChipLabel(v: RangeState): string {
  if (v.apenasZerados) return 'zerados'
  const min = v.min !== '' && v.min !== undefined ? v.min : null
  const max = v.max !== '' && v.max !== undefined ? v.max : null
  if (min !== null && max !== null) return `${min} – ${max}`
  if (min !== null) return `≥ ${min}`
  if (max !== null) return `≤ ${max}`
  return '—'
}

function isActive(type: 'multi' | 'range' | 'text', value: unknown): boolean {
  if (type === 'multi') return Array.isArray(value) && value.length > 0
  if (type === 'range') {
    const v = value as RangeState | undefined
    if (!v) return false
    return (v.min !== '' && v.min !== undefined) ||
           (v.max !== '' && v.max !== undefined) ||
           !!v.apenasZerados
  }
  if (type === 'text') return typeof value === 'string' && value.length > 0
  return false
}

export function FiltrosAtivosChips({
  filtros,
  filterTypes,
  labels,
  formatLabel,
  onRemove,
  onClearAll,
}: FiltrosAtivosChipsProps) {
  const active = Object.entries(filtros).filter(([key, val]) =>
    isActive(filterTypes[key] ?? 'multi', val),
  )

  if (active.length === 0) return null

  const totalChips = active.reduce((sum, [key, val]) => {
    const type = filterTypes[key] ?? 'multi'
    return sum + (type === 'multi' && Array.isArray(val) ? val.length : 1)
  }, 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
      <span className="text-xs text-muted-foreground shrink-0">Filtros:</span>

      {active.map(([colKey, val]) => {
        const type = filterTypes[colKey] ?? 'multi'
        const colLabel = labels[colKey] ?? colKey

        if (type === 'multi' && Array.isArray(val)) {
          return (val as string[]).map(v => (
            <Chip
              key={`${colKey}-${v}`}
              colLabel={colLabel}
              valueLabel={formatLabel?.[colKey]?.(v) ?? v}
              onRemove={() => onRemove(colKey, v)}
            />
          ))
        }

        if (type === 'range') {
          return (
            <Chip
              key={colKey}
              colLabel={colLabel}
              valueLabel={rangeChipLabel(val as RangeState)}
              onRemove={() => onRemove(colKey)}
            />
          )
        }

        if (type === 'text') {
          return (
            <Chip
              key={colKey}
              colLabel={colLabel}
              valueLabel={String(val)}
              onRemove={() => onRemove(colKey)}
            />
          )
        }

        return null
      })}

      {totalChips > 1 && (
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

function Chip({
  colLabel,
  valueLabel,
  onRemove,
}: {
  colLabel: string
  valueLabel: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">
      <span className="text-muted-foreground/80">{colLabel}:</span>
      <span className="text-primary">{valueLabel}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-primary/60 hover:text-primary hover:bg-primary/20 transition-colors"
        title="Remover filtro"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}
