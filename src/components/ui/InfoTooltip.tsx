import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface Props {
  label: string
  tip: string
}

/**
 * Exibe o label com um ícone (i) ao lado.
 * Hover no ícone mostra o tooltip via React portal (position: fixed),
 * escapando de qualquer overflow: hidden no container pai.
 */
export function InfoTooltip({ label, tip }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.top, left: r.left + r.width / 2 })
    }
    setVisible(true)
  }, [])

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        ref={ref}
        className="inline-flex cursor-help"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
      >
        <Info className="h-3 w-3 text-muted-foreground shrink-0" />
      </span>
      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, calc(-100% - 6px))',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="w-64 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg leading-relaxed"
        >
          {tip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </div>,
        document.body,
      )}
    </span>
  )
}
