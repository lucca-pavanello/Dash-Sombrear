import { useState, useCallback } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabase } from "@/lib/supabase"
import { TOOLS_GEMINI, NIVEIS_CONFIRMACAO, type NomeTool } from "./tools"
import { buildSystemPrompt } from "./systemPrompt"
import { executarTool, gerarPreviewAcao } from "./executors"
import type { MensagemChat, NivelConfirmacao, ChatContextoEstoque } from "./types"

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODELO = "gemini-2.5-flash-preview-05-20"

interface PendingConfirmation {
  tool_name: NomeTool
  tool_args: Record<string, unknown>
  nivel: NivelConfirmacao
  preview: string
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

export function useChat() {
  const [messages, setMessages] = useState<MensagemChat[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null)

  const sendMessage = useCallback(
    async (texto: string) => {
      if (!API_KEY || isLoading) return

      const userMsg: MensagemChat = {
        id: makeId(),
        role: "user",
        content: texto,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        // 1. Buscar snapshot do estoque
        const { data: contexto, error: ctxError } = await supabase.rpc(
          "estoque_chat_contexto"
        )
        if (ctxError) throw new Error("Erro ao buscar contexto: " + ctxError.message)

        const snap = contexto as ChatContextoEstoque

        // 2. Construir system prompt com snapshot
        const systemPrompt = buildSystemPrompt(snap)

        // 3. Inicializar Gemini
        const genAI = new GoogleGenerativeAI(API_KEY)
        const model = genAI.getGenerativeModel({
          model: MODELO,
          tools: [TOOLS_GEMINI],
          systemInstruction: systemPrompt,
        })

        // 4. Montar histórico (excluindo a mensagem atual já adicionada)
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: m.content }],
          }))

        const chat = model.startChat({ history })
        const result = await chat.sendMessage(texto)
        const response = result.response

        // 5. Processar resposta
        const functionCalls = response.functionCalls()

        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0]
          const toolName = call.name as NomeTool
          const args = call.args as Record<string, unknown>
          const nivel = NIVEIS_CONFIRMACAO[toolName] as NivelConfirmacao

          if (nivel === 1) {
            // Executa direto, sem confirmação
            const resultado = await executarTool(toolName, args)

            // Envia resultado de volta ao Gemini para ele gerar resposta em texto
            const followUp = await chat.sendMessage([
              {
                functionResponse: {
                  name: toolName,
                  response: resultado.dados ?? {
                    sucesso: resultado.sucesso,
                    mensagem: resultado.mensagem,
                  },
                },
              },
            ])

            const assistantMsg: MensagemChat = {
              id: makeId(),
              role: "assistant",
              content: followUp.response.text(),
              timestamp: new Date(),
              toolCall: {
                nome: toolName,
                args,
                nivelConfirmacao: nivel,
                confirmada: true,
                executada: true,
                resultado,
              },
            }
            setMessages((prev) => [...prev, assistantMsg])
          } else {
            // Nível 2 ou 3 — pede confirmação
            const preview = gerarPreviewAcao(toolName, args)
            setPendingConfirmation({ tool_name: toolName, tool_args: args, nivel, preview })

            const assistantMsg: MensagemChat = {
              id: makeId(),
              role: "assistant",
              content: `Vou ${toolName.replace(/_/g, " ")}. Confirme os detalhes abaixo antes de prosseguir.`,
              timestamp: new Date(),
              toolCall: {
                nome: toolName,
                args,
                nivelConfirmacao: nivel,
                confirmada: false,
                executada: false,
              },
            }
            setMessages((prev) => [...prev, assistantMsg])
          }
        } else {
          // Resposta de texto puro
          const assistantMsg: MensagemChat = {
            id: makeId(),
            role: "assistant",
            content: response.text(),
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMsg])
        }
      } catch (err) {
        const errMsg: MensagemChat = {
          id: makeId(),
          role: "assistant",
          content: "Erro ao contatar a IA. Tente novamente.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errMsg])
        console.error("useChat error:", err)
      } finally {
        setIsLoading(false)
      }
    },
    [messages, isLoading]
  )

  const confirmAction = useCallback(async () => {
    if (!pendingConfirmation || !API_KEY) return
    setIsLoading(true)

    const { tool_name, tool_args, nivel } = pendingConfirmation

    try {
      const resultado = await executarTool(tool_name, tool_args)

      // Manda resultado de volta ao Gemini para gerar resposta final
      const { data: contexto } = await supabase.rpc("estoque_chat_contexto")
      const snap = contexto as ChatContextoEstoque
      const systemPrompt = buildSystemPrompt(snap)

      const genAI = new GoogleGenerativeAI(API_KEY)
      const model = genAI.getGenerativeModel({
        model: MODELO,
        tools: [TOOLS_GEMINI],
        systemInstruction: systemPrompt,
      })

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: m.content }],
        }))

      const chat = model.startChat({ history })
      const followUp = await chat.sendMessage([
        {
          functionResponse: {
            name: tool_name,
            response: resultado.dados ?? {
              sucesso: resultado.sucesso,
              mensagem: resultado.mensagem,
            },
          },
        },
      ])

      const confirmedMsg: MensagemChat = {
        id: makeId(),
        role: "assistant",
        content: followUp.response.text(),
        timestamp: new Date(),
        toolCall: {
          nome: tool_name,
          args: tool_args,
          nivelConfirmacao: nivel,
          confirmada: true,
          executada: true,
          resultado,
        },
      }
      setMessages((prev) =>
        prev
          .map((m) =>
            m.toolCall?.nome === tool_name && !m.toolCall.executada
              ? {
                  ...m,
                  toolCall: { ...m.toolCall, confirmada: true, executada: true, resultado },
                }
              : m
          )
          .concat(confirmedMsg)
      )
    } catch (err) {
      const errMsg: MensagemChat = {
        id: makeId(),
        role: "assistant",
        content: "Erro ao executar a ação. Tente novamente.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errMsg])
      console.error("confirmAction error:", err)
    } finally {
      setPendingConfirmation(null)
      setIsLoading(false)
    }
  }, [pendingConfirmation, messages])

  const cancelAction = useCallback(() => {
    if (!pendingConfirmation) return
    const cancelMsg: MensagemChat = {
      id: makeId(),
      role: "assistant",
      content: "Ação cancelada.",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, cancelMsg])
    setPendingConfirmation(null)
  }, [pendingConfirmation])

  const clearChat = useCallback(() => {
    setMessages([])
    setPendingConfirmation(null)
  }, [])

  return {
    messages,
    isLoading,
    pendingConfirmation,
    sendMessage,
    confirmAction,
    cancelAction,
    clearChat,
    hasKey: !!API_KEY,
  }
}
