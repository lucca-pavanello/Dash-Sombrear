import { useState, useCallback } from 'react'

type SoundType = 'tab' | 'click'

function playSound(type: SoundType) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'tab') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(600, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.05)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
      osc.start()
      osc.stop(ctx.currentTime + 0.09)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(820, ctx.currentTime)
      gain.gain.setValueAtTime(0.03, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
      osc.start()
      osc.stop(ctx.currentTime + 0.06)
    }
  } catch { /* browser pode bloquear sem interação prévia */ }
}

export function useUiSound() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('ui-sounds') !== 'false')

  const play = useCallback(
    (type: SoundType) => { if (enabled) playSound(type) },
    [enabled],
  )

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      localStorage.setItem('ui-sounds', String(next))
      return next
    })
  }, [])

  return { play, enabled, toggle }
}
