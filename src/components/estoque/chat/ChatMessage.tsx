import { Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { MensagemChat } from "./types"

interface Props {
  mensagem: MensagemChat
}

export function ChatMensagem({ mensagem }: Props) {
  const isUser = mensagem.role === "user"

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-orange-600" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "bg-orange-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        <div className="prose prose-sm max-w-none [&>p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&>p:not(:first-child)]:mt-1">
          <ReactMarkdown>{mensagem.content}</ReactMarkdown>
        </div>

        {mensagem.toolCall?.executada && (
          <div
            className={`mt-2 pt-2 border-t text-xs flex items-center gap-1 ${
              isUser ? "border-white/20 text-white/80" : "border-gray-200 text-gray-500"
            }`}
          >
            ✓ Ação executada: {mensagem.toolCall.nome}
          </div>
        )}
      </div>
    </div>
  )
}
