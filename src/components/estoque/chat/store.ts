import { create } from "zustand"

interface ChatStore {
  aberto: boolean
  abrir: () => void
  fechar: () => void
  toggle: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
  toggle: () => set((s) => ({ aberto: !s.aberto })),
}))
