import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
  undoAction?: () => void
}

let idCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((
    type: ToastType,
    message: string,
    opts?: { duration?: number; undoAction?: () => void },
  ) => {
    const id = ++idCounter
    const duration = opts?.duration ?? 3500
    setToasts((prev) => [...prev, { id, type, message, duration, undoAction: opts?.undoAction }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
