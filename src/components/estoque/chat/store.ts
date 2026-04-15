import { create } from "zustand"
import type { MensagemChat } from "./types"
import type { NomeTool } from "./tools"

export interface ConfirmacaoPendente {
  toolName: NomeTool
  toolArgs: Record<string, unknown>
  nivelConfirmacao: 2 | 3
  preview: string
}

interface ChatStore {
  aberto: boolean
  mensagens: MensagemChat[]
  loading: boolean
  confirmacaoPendente: ConfirmacaoPendente | null

  abrir: () => void
  fechar: () => void
  toggle: () => void

  adicionarMensagem: (msg: MensagemChat) => void
  limparMensagens: () => void
  setLoading: (loading: boolean) => void
  setConfirmacaoPendente: (conf: ConfirmacaoPendente | null) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  aberto: false,
  mensagens: [],
  loading: false,
  confirmacaoPendente: null,

  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
  toggle: () => set((s) => ({ aberto: !s.aberto })),

  adicionarMensagem: (msg) => set((s) => ({ mensagens: [...s.mensagens, msg] })),
  limparMensagens: () => set({ mensagens: [], confirmacaoPendente: null }),
  setLoading: (loading) => set({ loading }),
  setConfirmacaoPendente: (conf) => set({ confirmacaoPendente: conf }),
}))
