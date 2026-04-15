import * as Dialog from "@radix-ui/react-dialog"
import { AlertTriangle, ShieldCheck, X } from "lucide-react"
import { useChatStore } from "./store"
import { useChatAPI } from "./useChatAPI"

export function ConfirmacaoAcao() {
  const { confirmacaoPendente, setConfirmacaoPendente } = useChatStore()
  const { confirmarAcao, cancelarAcao } = useChatAPI()

  if (!confirmacaoPendente) return null

  const isNivel3 = confirmacaoPendente.nivelConfirmacao === 3

  const confirmar = async () => {
    const { toolName, toolArgs } = confirmacaoPendente
    setConfirmacaoPendente(null)
    await confirmarAcao(toolName, toolArgs)
  }

  const cancelar = () => {
    setConfirmacaoPendente(null)
    cancelarAcao()
  }

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && cancelar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="confirmacao-preview"
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                isNivel3 ? "bg-red-100" : "bg-orange-100"
              }`}
            >
              {isNivel3 ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold text-gray-900">
                {isNivel3 ? "Confirmar operação" : "Confirmar ação"}
              </Dialog.Title>
              <p className="text-xs text-gray-500 mt-0.5">
                {isNivel3
                  ? "Esta operação afeta estoque ou dinheiro. Revise antes de confirmar."
                  : "Confirme para prosseguir."}
              </p>
            </div>
            <button
              onClick={cancelar}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Preview */}
          <div
            id="confirmacao-preview"
            className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
              {confirmacaoPendente.preview}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={cancelar}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
                isNivel3
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {isNivel3 ? "Confirmar e executar" : "Confirmar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
