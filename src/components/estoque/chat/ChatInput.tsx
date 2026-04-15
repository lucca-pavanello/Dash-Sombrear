import { useState } from "react"
import type { KeyboardEvent } from "react"
import { Send } from "lucide-react"
import { useChatStore } from "./store"
import { useChatAPI } from "./useChatAPI"

export function ChatInput() {
  const [texto, setTexto] = useState("")
  const { loading } = useChatStore()
  const { enviarMensagem } = useChatAPI()

  const enviar = async () => {
    if (!texto.trim() || loading) return
    const txt = texto.trim()
    setTexto("")
    await enviarMensagem(txt)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pergunte algo ou peça uma ação..."
        rows={1}
        disabled={loading}
        className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
      />
      <button
        onClick={enviar}
        disabled={!texto.trim() || loading}
        className="h-10 w-10 flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white shrink-0 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}
