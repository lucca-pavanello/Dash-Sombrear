import { flushSync } from 'react-dom'

/** Navegação com crossfade nativo (View Transitions API).
 *  Sem suporte ou com prefers-reduced-motion → navega direto. */
export function comTransicao(navegar: () => void) {
  type DocVT = Document & { startViewTransition?: (cb: () => void) => void }
  const doc = document as DocVT
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduz) { navegar(); return }
  doc.startViewTransition(() => { flushSync(navegar) })
}
