import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Orcamento } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

export type GeminiMessage = { role: 'user' | 'model'; text: string }

export interface GeminiContext {
  totalOrc: number
  fechados: number
  convRate: number
  faturamento: number
  ticketMedio: number
  margemMedia: number | null
  emAberto: number
  emRisco: number
  responsaveis: string[]
}

function buildSystemPrompt(ctx: GeminiContext): string {
  const resp = ctx.responsaveis.length > 0 ? ctx.responsaveis.slice(0, 5).join(', ') : 'não informado'
  return `Você é um assistente de vendas e negócios da empresa Sombrear, especializada em cortinas e sombras sob medida.
Responda SEMPRE em português BR, de forma direta e acionável (máximo 4 linhas por resposta).

Dados atuais do dashboard (atualizado agora):
- Total de orçamentos no período: ${ctx.totalOrc}
- Fechamentos: ${ctx.fechados} (${ctx.convRate.toFixed(1)}% de conversão)
- Faturamento total: ${formatCurrency(ctx.faturamento)}
- Ticket médio: ${ctx.ticketMedio > 0 ? formatCurrency(ctx.ticketMedio) : 'sem dados'}
- Margem média: ${ctx.margemMedia != null ? ctx.margemMedia.toFixed(1) + '%' : 'sem dados de custo'}
- Em aberto: ${ctx.emAberto} orçamentos | Em risco (sem resposta +7 dias): ${ctx.emRisco}
- Responsáveis: ${resp}

Seja objetivo, prático e motivador. Se não souber algo com os dados disponíveis, diga claramente.`
}

export function useGemini() {
  const [messages, setMessages] = useState<GeminiMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (userText: string, ctx: GeminiContext) => {
    const userMsg: GeminiMessage = { role: 'user', text: userText }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const history = [...messages, userMsg]
      const contents = [
        // Gemini não tem "system" role nativo — colocamos como primeira mensagem de user
        { role: 'user', parts: [{ text: buildSystemPrompt(ctx) }] },
        { role: 'model', parts: [{ text: 'Entendido. Estou pronto para ajudar com os dados do Sombrear.' }] },
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
      ]

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { contents },
      })

      if (error) throw new Error(error.message)
      const reply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sem resposta.'
      setMessages(prev => [...prev, { role: 'model', text: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Erro ao contatar o Gemini. Tente novamente.' }])
      console.error('Gemini error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const clearChat = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearChat, hasKey: true }
}

export function buildGeminiContext(data: Orcamento[]): GeminiContext {
  const fechados = data.filter(o => o.fechado === true)
  const emAberto = data.filter(o => !o.fechado)
  const faturamento = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
  const ticketMedio = fechados.length > 0 ? faturamento / fechados.length : 0
  const comMargem = data.filter(o => o.margem != null)
  const margemMedia = comMargem.length > 0
    ? comMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / comMargem.length
    : null
  const agora = Date.now()
  const emRisco = emAberto.filter(o => {
    const dias = Math.floor((agora - new Date(o.updated_at ?? o.created_at).getTime()) / 86400000)
    return dias > 7
  })
  const responsaveis = [...new Set(data.map(o => o.responsavel))]
  return {
    totalOrc: data.length,
    fechados: fechados.length,
    convRate: data.length > 0 ? (fechados.length / data.length) * 100 : 0,
    faturamento,
    ticketMedio,
    margemMedia,
    emAberto: emAberto.length,
    emRisco: emRisco.length,
    responsaveis,
  }
}
