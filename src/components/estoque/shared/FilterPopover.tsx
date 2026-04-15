import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RangeState {
  min?: number | ''
  max?: number | ''
  apenasZerados?: boolean
  incluirVazios?: boolean
}

export interface RangeOpts {
  showApenasZerados?: boolean
  apenasZeradosLabel?: string
  showIncluirVazios?: boolean
  incluirVaziosLabel?: string
}

interface FilterPopoverProps {
  label: string
  hint?: string
  filterType: 'multi' | 'range' | 'text'
  options?: { value: string; label: string }[]
  value: unknown
  onChange: (v: unknown) => void
  open: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  rangeOpts?: RangeOpts
}

// ─── MultiSelectFilter ────────────────────────────────────────────────────────

function MultiSelectFilter({
  options,
  pending,
  setPending,
}: {
  options: { value: string; label: string }[]
  pending: string[]
  setPending: (v: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const visible = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  function toggle(value: string) {
    setPending(
      pending.includes(value) ? pending.filter(v => v !== value) : [...pending, value],
    )
  }

  return (
    <div className="space-y-1">
      {options.length > 5 && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar opção..."
          className="w-full rounded-lg border border-border bg-background h-8 px-3 text-sm text-center placeholder:text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-2"
        />
      )}
      <div className="space-y-0.5">
        {visible.map(opt => (
          <label
            key={opt.value}
            className="flex items-center justify-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={pending.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="accent-primary h-3.5 w-3.5 shrink-0"
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhuma opção encontrada</p>
        )}
      </div>
    </div>
  )
}

// ─── RangeFilter ──────────────────────────────────────────────────────────────

function RangeFilter({
  pending,
  setPending,
  rangeOpts,
}: {
  pending: RangeState
  setPending: (v: RangeState) => void
  rangeOpts?: RangeOpts
}) {
  function update(patch: Partial<RangeState>) {
    setPending({ ...pending, ...patch })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block text-center">De</label>
          <input
            type="number"
            placeholder="Mín"
            value={pending.min ?? ''}
            onChange={e => update({ min: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-background h-8 px-3 text-sm text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block text-center">Até</label>
          <input
            type="number"
            placeholder="Máx"
            value={pending.max ?? ''}
            onChange={e => update({ max: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-background h-8 px-3 text-sm text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      {(rangeOpts?.showApenasZerados || rangeOpts?.showIncluirVazios) && (
        <div className="border-t border-border pt-3 space-y-1.5">
          {rangeOpts?.showApenasZerados && (
            <label className="flex items-center justify-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pending.apenasZerados ?? false}
                onChange={e => update({ apenasZerados: e.target.checked, min: '', max: '' })}
                className="accent-primary h-3.5 w-3.5 shrink-0"
              />
              <span className="text-sm text-foreground">
                {rangeOpts.apenasZeradosLabel ?? 'Apenas valor zero'}
              </span>
            </label>
          )}
          {rangeOpts?.showIncluirVazios && (
            <label className="flex items-center justify-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pending.incluirVazios ?? false}
                onChange={e => update({ incluirVazios: e.target.checked })}
                className="accent-primary h-3.5 w-3.5 shrink-0"
              />
              <span className="text-sm text-foreground">
                {rangeOpts.incluirVaziosLabel ?? 'Incluir sem valor definido'}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TextFilter ───────────────────────────────────────────────────────────────

function TextFilter({
  pending,
  setPending,
  label,
}: {
  pending: string
  setPending: (v: string) => void
  label: string
}) {
  return (
    <div>
      <input
        type="text"
        value={pending}
        onChange={e => setPending(e.target.value)}
        placeholder={`Buscar em ${label}...`}
        autoFocus
        className="w-full rounded-lg border border-border bg-background h-9 px-3 text-sm text-center placeholder:text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Filtra parcialmente — ex: "blackout" encontra "Tecido Blackout Branco"
      </p>
    </div>
  )
}

// ─── FilterPopover ────────────────────────────────────────────────────────────

const RANGE_EMPTY: RangeState = {}

export function FilterPopover({
  label,
  hint,
  filterType,
  options = [],
  value,
  onChange,
  open,
  anchorRect,
  onClose,
  rangeOpts,
}: FilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Pending state per type
  const [pendingMulti, setPendingMulti] = useState<string[]>([])
  const [pendingRange, setPendingRange] = useState<RangeState>(RANGE_EMPTY)
  const [pendingText, setPendingText] = useState<string>('')

  // Sync pending from external value when opening
  useEffect(() => {
    if (!open) return
    if (filterType === 'multi') {
      setPendingMulti(Array.isArray(value) ? (value as string[]) : [])
    } else if (filterType === 'range') {
      setPendingRange((value as RangeState) ?? RANGE_EMPTY)
    } else {
      setPendingText(typeof value === 'string' ? value : '')
    }
  }, [open, value, filterType])

  // Click-outside + Escape
  useEffect(() => {
    if (!open) return
    function handleMouse(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouse)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouse)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open || !anchorRect) return null

  // Position: below anchor, avoid right edge
  const W = 288 // w-72
  const rawLeft = anchorRect.left
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - W - 8))
  const top = anchorRect.bottom + 4

  function apply() {
    if (filterType === 'multi') onChange(pendingMulti)
    else if (filterType === 'range') onChange(pendingRange)
    else onChange(pendingText)
    onClose()
  }

  function clear() {
    if (filterType === 'multi') { setPendingMulti([]); onChange([]) }
    else if (filterType === 'range') { setPendingRange(RANGE_EMPTY); onChange(RANGE_EMPTY) }
    else { setPendingText(''); onChange('') }
    onClose()
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: W }}
      className="rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/40 text-center">
        <h4 className="text-sm font-semibold text-foreground">Filtrar por {label}</h4>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>

      {/* Content */}
      <div className="p-3 max-h-72 overflow-y-auto">
        {filterType === 'multi' && (
          <MultiSelectFilter
            options={options}
            pending={pendingMulti}
            setPending={setPendingMulti}
          />
        )}
        {filterType === 'range' && (
          <RangeFilter
            pending={pendingRange}
            setPending={setPendingRange}
            rangeOpts={rangeOpts}
          />
        )}
        {filterType === 'text' && (
          <TextFilter
            pending={pendingText}
            setPending={setPendingText}
            label={label}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-muted/40">
        <button
          onClick={clear}
          className="flex-1 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          Limpar
        </button>
        <button
          onClick={apply}
          className="flex-1 h-8 px-4 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ─── Helper: is filter active ─────────────────────────────────────────────────

export function isFilterActive(filterType: 'multi' | 'range' | 'text', value: unknown): boolean {
  if (filterType === 'multi') return Array.isArray(value) && value.length > 0
  if (filterType === 'range') {
    const v = value as RangeState | undefined
    if (!v) return false
    return !!(v.min !== '' && v.min !== undefined) ||
           !!(v.max !== '' && v.max !== undefined) ||
           !!v.apenasZerados
  }
  if (filterType === 'text') return typeof value === 'string' && value.length > 0
  return false
}
