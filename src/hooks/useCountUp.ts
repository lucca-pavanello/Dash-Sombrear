import { useEffect, useRef, useState } from 'react'

// Ease-out exponential — começa rápido, desacelera suavemente (Apple-style)
const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t)

export function useCountUp(target: number, duration = 850, skipAnimation = false, resetKey?: number): number {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const currentRef = useRef(0)

  // When resetKey changes, reset the starting point to 0 so the next animation starts from scratch
  useEffect(() => {
    if (resetKey === undefined) return
    currentRef.current = 0
  }, [resetKey])

  useEffect(() => {
    // número girando é movimento que o CSS não alcança: quem pediu menos
    // movimento vê o valor final direto
    const reduz = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // aba em segundo plano: o rAF não roda e o KPI ficaria parado em 0 até a
    // aba voltar ao foco (portado do CRM do kit Agente-IA)
    if (skipAnimation || reduz || document.hidden) {
      currentRef.current = target
      setCurrent(target)
      return
    }

    const from = currentRef.current
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = 0

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const val = from + (target - from) * easeOutExpo(progress)
      currentRef.current = val
      setCurrent(val)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        currentRef.current = target
        setCurrent(target)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, skipAnimation, resetKey])

  return current
}
