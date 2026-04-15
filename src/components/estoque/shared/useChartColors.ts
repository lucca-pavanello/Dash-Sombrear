import { useState, useEffect } from 'react'

export function useChartColors() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return {
    grid:      dark ? '#374151' : '#f3f4f6',  // gray-700 / gray-100
    axisLabel: dark ? '#9ca3af' : '#94a3b8',  // gray-400 / slate-400
    lineDark:  dark ? '#9ca3af' : '#374151',  // gray-400 / gray-700
    lineGray:  dark ? '#6b7280' : '#9ca3af',  // gray-500 / gray-400
  }
}
