import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export function CustomSelect({ value, onChange, options, placeholder = 'Selecione...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const panelHeight = Math.min(options.length * 44 + 8, 260)
    const openUpward = spaceBelow < panelHeight && rect.top > panelHeight

    setStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [options.length])

  function handleToggle() {
    if (disabled) return
    if (!open) updatePosition()
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
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
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 outline-none',
          open
            ? 'border-primary ring-2 ring-primary/15 bg-background'
            : 'border-border bg-background hover:border-muted-foreground/40',
          disabled && 'opacity-50 cursor-not-allowed bg-muted/30 pointer-events-none',
          !value ? 'text-muted-foreground/50' : 'text-foreground'
        )}
      >
        <span className="flex-1 text-center truncate">{value || placeholder}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          style={style}
          className="rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto py-1 overscroll-contain">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100 text-left',
                  opt === value
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <span className="flex-1 truncate">{opt}</span>
                {opt === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
