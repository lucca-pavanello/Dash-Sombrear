interface Payload {
  value?: unknown
  name?: string
  color?: string
}

interface Props {
  active?: boolean
  payload?: Payload[]
  label?: string
  formatter?: (value: number, name?: string) => string
}

export default function ChartTooltip({ active, payload, label, formatter }: Props) {
  if (!active || !payload?.length) return null

  return (
    <div className="animate-in fade-in-0 zoom-in-95 duration-150 rounded-xl border border-primary/20 bg-card/95 dark:bg-card/80 dark:backdrop-blur-md px-4 py-3 shadow-elevated">
      {label != null && label !== '' && (
        <p className="font-display mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => {
          const raw = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0)
          const display = formatter
            ? formatter(raw, entry.name)
            : raw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: entry.color ?? 'hsl(var(--primary))' }}
              />
              {entry.name && (
                <span className="text-muted-foreground">{entry.name}</span>
              )}
              <span className="ml-auto pl-4 font-semibold tabular-nums text-foreground">
                {display}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
