import { useIsFetching } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export default function TopLoadingBar() {
  const fetching = useIsFetching()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (fetching > 0) {
      setFading(false)
      setVisible(true)
    } else if (visible) {
      setFading(true)
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }
  }, [fetching, visible])

  if (!visible) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] h-0.5 overflow-hidden transition-opacity duration-[400ms] ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="h-full w-full bg-brand-gradient top-loading-bar" />
    </div>
  )
}
