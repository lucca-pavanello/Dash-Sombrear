import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type SelectOption = string | { value: string; label: string }

function getVal(o: SelectOption) { return typeof o === 'string' ? o : o.value }
function getLbl(o: SelectOption) { return typeof o === 'string' ? o : o.label }

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomSelect({ value, onChange, options, placeholder = 'Selecione…', disabled, className }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const showSearch = options.length > 7
  const filtered = search
    ? options.filter(o => getLbl(o).toLowerCase().includes(search.toLowerCase()))
    : options

  /* ── Posicionamento fixed ── */
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const panelHeight = Math.min(options.length * 42 + (showSearch ? 52 : 0) + 8, 300)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < panelHeight + 8 && rect.top > panelHeight

    setStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 200),
      zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    })
  }, [options.length, showSearch])

  /* ── Abrir/fechar ── */
  function handleToggle() {
    if (disabled) return
    if (!open) {
      updatePosition()
      setSearch('')
      const idx = options.findIndex(o => getVal(o) === value)
      setFocusedIdx(idx >= 0 ? idx : 0)
    }
    setOpen(v => !v)
  }

  /* ── Auto-foca busca e scroll para item selecionado ── */
  useEffect(() => {
    if (!open) return
    if (showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    // Scroll para item selecionado
    const idx = filtered.findIndex(o => getVal(o) === value)
    if (idx >= 0) {
      requestAnimationFrame(() => {
        itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' })
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Scroll para item focado por teclado ── */
  useEffect(() => {
    if (focusedIdx >= 0) {
      itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIdx])

  /* ── Event listeners ── */
  useEffect(() => {
    if (!open) return

    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && focusedIdx >= 0 && filtered[focusedIdx]) {
        e.preventDefault()
        onChange(getVal(filtered[focusedIdx]))
        setOpen(false)
        setSearch('')
        buttonRef.current?.focus()
      }
    }
    function onScroll() { updatePosition() }

    document.addEventListener('mousedown', onOutside)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, filtered, focusedIdx, onChange, updatePosition])

  /* ── Reset focusedIdx quando filtro muda ── */
  useEffect(() => {
    setFocusedIdx(0)
  }, [search])

  return (
    <>
      {/* ── Trigger ── */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 outline-none',
          open
            ? 'border-primary ring-2 ring-primary/15 bg-background'
            : 'border-border bg-background hover:border-muted-foreground/40',
          disabled && 'opacity-50 cursor-not-allowed bg-muted/30 pointer-events-none',
          !value ? 'text-muted-foreground/50' : 'text-foreground',
          className,
        )}
      >
        <span className="flex-1 text-center truncate">
          {value ? (getLbl(options.find(o => getVal(o) === value) ?? value)) : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* ── Dropdown panel (portal → fora de qualquer stacking context pai) ── */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={style}
          role="listbox"
          aria-label="Opções"
          className="rounded-xl border border-border/80 bg-card overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Acento no topo */}
          <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          {/* Campo de busca */}
          {showSearch && (
            <div className="px-3 pt-2.5 pb-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Buscar…"
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Lista */}
          <div ref={listRef} className="max-h-[248px] overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhuma opção encontrada</p>
            ) : (
              filtered.map((opt, idx) => {
                const v = getVal(opt)
                const l = getLbl(opt)
                const selected = v === value
                const focused = idx === focusedIdx
                return (
                  <button
                    key={v}
                    ref={el => { itemRefs.current[idx] = el }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { onChange(v); setOpen(false); setSearch('') }}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors duration-75',
                      selected ? 'bg-primary/[0.08] text-primary'
                        : focused ? 'bg-muted/60 text-foreground'
                        : 'text-foreground/80 hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-150',
                      selected ? 'border-primary bg-primary' : 'border-border/60'
                    )}>
                      {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate font-medium">{l}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Rodapé de contagem */}
          {showSearch && search && filtered.length > 0 && (
            <div className="border-t border-border/40 px-3 py-1.5 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/60">
                {filtered.length} de {options.length} opções
              </p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors underline underline-offset-2"
              >
                limpar
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
