import { useRef, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Sparkles, X, Trash2 } from "lucide-react"
import { useChatStore } from "./store"
import { ChatMensagem } from "./ChatMessage"
import { ChatInput } from "./ChatInput"
import { ChatSugestoes } from "./ChatSugestoes"

export function ChatDrawer() {
  const { aberto, fechar, mensagens, loading, limparMensagens } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagens, loading])

  return (
    <Dialog.Root open={aberto} onOpenChange={(open) => !open && fechar()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Drawer panel */}
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                <Sparkles className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-gray-900">
                  IA do Estoque
                </Dialog.Title>
                <p className="text-xs text-gray-500">Pergunte ou peça uma ação</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {mensagens.length > 0 && (
                <button
                  onClick={limparMensagens}
                  title="Limpar conversa"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {mensagens.length === 0 ? (
              <ChatSugestoes />
            ) : (
              <div className="space-y-4">
                {mensagens.map((msg) => (
                  <ChatMensagem key={msg.id} mensagem={msg} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="flex gap-1">
                      <div
                        className="h-2 w-2 rounded-full bg-orange-500 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="h-2 w-2 rounded-full bg-orange-500 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="h-2 w-2 rounded-full bg-orange-500 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span>Pensando...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer input */}
          <div className="border-t border-gray-200 bg-gray-50 p-3">
            <ChatInput />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
