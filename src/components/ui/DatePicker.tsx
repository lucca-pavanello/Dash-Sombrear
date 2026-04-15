import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DatePickerProps {
  value: string // YYYY-MM-DD or ''
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  className?: string
  triggerClassName?: string
}

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', min, max, className = '', triggerClassName }: DatePickerProps) {
  const today = new Date()

  const parsed = value ? new Date(value + 'T00:00') : null
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  // Sync view to value when it changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function displayValue() {
    if (!parsed) return ''
    const d = parsed
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function toYMD(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function selectDay(day: number) {
    const formatted = toYMD(viewYear, viewMonth, day)
    if (min && formatted < min) return
    if (max && formatted > max) return
    onChange(formatted)
    setOpen(false)
  }

  function isSelected(day: number) {
    if (!value) return false
    return value === toYMD(viewYear, viewMonth, day)
  }

  function isToday(day: number) {
    return toYMD(today.getFullYear(), today.getMonth(), today.getDate()) === toYMD(viewYear, viewMonth, day)
  }

  function isDisabled(day: number) {
    const formatted = toYMD(viewYear, viewMonth, day)
    if (min && formatted < min) return true
    if (max && formatted > max) return true
    return false
  }

  function selectToday() {
    const formatted = toYMD(today.getFullYear(), today.getMonth(), today.getDate())
    if (min && formatted < min) return
    if (max && formatted > max) return
    onChange(formatted)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(v => !v)}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-all duration-150 hover:border-primary/50 select-none
          ${open ? 'border-primary ring-2 ring-primary/15' : 'border-border'} ${triggerClassName ?? ''}`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={`flex-1 tabular-nums ${value ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>
          {displayValue() || placeholder}
        </span>
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Limpar data"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-[calc(100vw-2rem)] max-w-[264px] animate-in fade-in-0 slide-in-from-top-2 duration-150 rounded-xl border border-border bg-card p-3.5 shadow-elevated">
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7">
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1
              const sel = isSelected(day)
              const tod = isToday(day)
              const dis = isDisabled(day)
              return (
                <button
                  key={day}
                  onClick={() => !dis && selectDay(day)}
                  disabled={dis}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition-all duration-100
                    ${sel ? 'bg-primary text-white shadow-sm scale-105' : ''}
                    ${!sel && tod ? 'border border-primary/60 text-primary font-bold' : ''}
                    ${!sel && !tod && !dis ? 'text-foreground hover:bg-primary/10 hover:text-primary' : ''}
                    ${dis ? 'cursor-not-allowed opacity-25' : 'cursor-pointer'}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t pt-2.5">
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Limpar
            </button>
            <button
              onClick={selectToday}
              className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
