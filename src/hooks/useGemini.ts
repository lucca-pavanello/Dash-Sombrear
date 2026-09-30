import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * O copiloto do dash. As contas agora acontecem no servidor (Edge Function
 * `copilot-ia`), com ferramentas que leem os dados reais; o navegador só manda a
 * pergunta e o histórico.
 *
 * `erro: true` marca o balão que é aviso, não resposta: ele não vai para o histórico
 * da IA (antes "Erro ao contatar o Gemini" era reenviado como se o modelo tivesse dito)
 * e é ele que o `repetir()` substitui.
 */
export type GeminiMessage = { role: 'user' | 'model'; text: string; erro?: true }

export type OpcoesPergunta = {
  /** vendedor em foco no dash: as vendas passam a ser só dele */
  responsavel?: string | null
}

const MAX_HISTORICO = 10

/** Frase pra quem usa, pelo status da resposta; nunca o corpo cru do erro. */
export function fraseDoErro(status: number | null): string {
  if (status === 401) return 'Sua sessão expirou. Entre de novo para usar o copiloto.'
  if (status === 403) return 'Seu acesso ainda não foi aprovado para usar o copiloto.'
  if (status === 429) return 'Muita gente perguntando ao mesmo tempo. Espere um minuto e tente de novo.'
  if (status === null) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return 'O copiloto não conseguiu responder agora. Tente de novo em instantes.'
}

function statusDoErro(error: unknown): number | null {
  // FunctionsHttpError traz a Response em `context`; erro de rede não tem status
  const ctx = (error as { context?: { status?: number } } | null)?.context
  return typeof ctx?.status === 'number' ? ctx.status : null
}

export function useGemini() {
  const [messages, setMessages] = useState<GeminiMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const ultimaPergunta = useRef<{ texto: string; opcoes?: OpcoesPergunta } | null>(null)
  const emVoo = useRef(false)

  const perguntar = useCallback(async (texto: string, opcoes: OpcoesPergunta | undefined, anteriores: GeminiMessage[]) => {
    if (emVoo.current) return
    emVoo.current = true
    ultimaPergunta.current = { texto, opcoes }
    setMessages([...anteriores, { role: 'user', text: texto }])
    setIsLoading(true)
    try {
      const historico = anteriores.filter(m => !m.erro).slice(-MAX_HISTORICO).map(({ role, text }) => ({ role, text }))
      const { data, error } = await supabase.functions.invoke('copilot-ia', {
        body: { pergunta: texto, historico, responsavel: opcoes?.responsavel ?? null },
      })
      if (error) throw error
      if (!data?.ok || typeof data.resposta !== 'string') throw Object.assign(new Error('resposta inválida'), { context: { status: 500 } })
      setMessages(prev => [...prev, { role: 'model', text: data.resposta }])
    } catch (err) {
      console.error('copilot-ia:', err)
      const status = statusDoErro(err)
      setMessages(prev => [...prev, { role: 'model', text: fraseDoErro(status), erro: true }])
    } finally {
      emVoo.current = false
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback((texto: string, opcoes?: OpcoesPergunta) => {
    const t = texto.trim()
    if (!t) return
    void perguntar(t, opcoes, messages)
  }, [messages, perguntar])

  /** Reenvia a última pergunta, tirando o balão de erro e a pergunta repetida. */
  const repetir = useCallback(() => {
    const ultima = ultimaPergunta.current
    if (!ultima) return
    let base = [...messages]
    const ultimo = () => base[base.length - 1]
    if (ultimo()?.erro) base = base.slice(0, -1)
    if (ultimo()?.role === 'user' && ultimo()?.text === ultima.texto) base = base.slice(0, -1)
    void perguntar(ultima.texto, ultima.opcoes, base)
  }, [messages, perguntar])

  const clearChat = useCallback(() => {
    setMessages([])
    ultimaPergunta.current = null
  }, [])

  return { messages, isLoading, sendMessage, repetir, clearChat }
}
