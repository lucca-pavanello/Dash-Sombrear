import { Sparkles, ShoppingCart, TrendingUp, Clock, Package, Calculator } from "lucide-react"
import { useChatAPI } from "./useChatAPI"

const SUGESTOES = [
  { icon: TrendingUp, texto: "Como está meu estoque hoje?", categoria: "Visão geral" },
  { icon: ShoppingCart, texto: "O que preciso comprar agora?", categoria: "Ações" },
  { icon: Clock, texto: "Quais produtos estão parados há mais de 90 dias?", categoria: "Análise" },
  { icon: Calculator, texto: "Recalcula a curva ABC pra mim", categoria: "Operação" },
  { icon: Package, texto: "Quais são meus 5 produtos mais vendidos?", categoria: "Análise" },
  { icon: Sparkles, texto: "Me dá um insight sobre meu negócio", categoria: "IA" },
]

export function ChatSugestoes() {
  const { enviarMensagem } = useChatAPI()

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-orange-100 items-center justify-center mb-3">
          <Sparkles className="h-6 w-6 text-orange-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Como posso te ajudar?</h3>
        <p className="text-sm text-gray-500 mt-1">Faça perguntas ou peça ações</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-gray-400 font-medium px-1">Sugestões</p>
        {SUGESTOES.map((sug, i) => (
          <button
            key={i}
            onClick={() => enviarMensagem(sug.texto)}
            className="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left group"
          >
            <div className="h-8 w-8 rounded-lg bg-gray-50 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
              <sug.icon className="h-4 w-4 text-gray-500 group-hover:text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 group-hover:text-orange-900">{sug.texto}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sug.categoria}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
