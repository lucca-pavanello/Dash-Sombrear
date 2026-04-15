import { Info } from 'lucide-react'

interface Props {
  label: string
  tip: string
}

/**
 * Exibe o label com um ícone (i) ao lado.
 * Hover no ícone mostra o tooltip.
 */
export function InfoTooltip({ label, tip }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="relative group inline-flex">
        <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
        <span
          className="
            pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
            w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md
            opacity-0 group-hover:opacity-100 transition-opacity duration-150
          "
          style={{ lineHeight: '1.5' }}
        >
          {tip}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
        </span>
      </span>
    </span>
  )
}
