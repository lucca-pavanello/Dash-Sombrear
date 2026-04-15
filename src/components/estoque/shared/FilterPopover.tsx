import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface FilterPopoverProps {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function FilterPopover({ label, options, selected, onChange }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const w = 208
      const left = Math.min(rect.left, window.innerWidth - w - 8)
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) })
    }
    setPending([...selected])
    setOpen(true)
  }

  function toggle(value: string) {
    setPending(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
    )
  }

  function apply() {
    onChange(pending)
    setOpen(false)
  }

  function clear() {
    setPending([])
    onChange([])
    setOpen(false)
  }

  const isActive = selected.length > 0

  return (
    <>
      <button
        ref={triggerRef}
        onClick={open ? () => setOpen(false) : handleOpen}
        className={cn(
          'inline-flex items-center gap-1 transition-colors font-semibold text-[11px] uppercase tracking-wide',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
        title={`Filtrar por ${label}`}
      >
        {label}
        <Filter
          className={cn(
            'h-3 w-3 shrink-0',
            isActive ? 'text-primary fill-primary/30' : 'text-muted-foreground/50',
          )}
        />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 rounded-lg border border-border bg-popover shadow-lg text-sm overflow-hidden"
        >
          <div className="p-1.5 flex flex-col max-h-56 overflow-y-auto">
            {options.map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer select-none"
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
          </div>
          <div className="border-t border-border p-2 flex gap-2">
            <button
              onClick={apply}
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
            <button
              onClick={clear}
              className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
