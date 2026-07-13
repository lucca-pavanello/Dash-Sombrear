import { Sparkles } from "lucide-react"
import { useChatStore } from "./store"
import { isAIEstoqueEnabled } from "./featureFlag"

export function ChatTrigger() {
  const { abrir } = useChatStore()

  if (!isAIEstoqueEnabled()) return null

  return (
    <button
      onClick={abrir}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient hover:brightness-110 px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all"
    >
      <Sparkles className="h-4 w-4" />
      Perguntar à IA
    </button>
  )
}
