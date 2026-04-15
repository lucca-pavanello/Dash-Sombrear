import { useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { TOOLS_GEMINI, NIVEIS_CONFIRMACAO, type NomeTool } from "./tools"
import { buildSystemPrompt } from "./systemPrompt"
import { executarTool, gerarPreviewAcao } from "./executors"
import type { MensagemChat, NivelConfirmacao, ChatContextoEstoque } from "./types"

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

/** Chama a Edge Function gemini-estoque e retorna o data parsed. */
async function callGemini(payload: {
  model: string
  contents: unknown[]
  tools?: unknown[]
  systemInstruction?: { parts: [{ text: string }] }
}) {
  const { data, error } = await supabase.functions.invoke("gemini-estoque", { body: payload })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(JSON.stringify(data.error))
  return data
}

export function useChat() {
  const [messages, setMessages] = useState<MensagemChat[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null)

  const sendMessage = useCallback(
    async (texto: string) => {
      if (isLoading) return

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
        const { data: contexto, error: ctxError } = await supabase.rpc("estoque_chat_contexto")
        if (ctxError) throw new Error("Erro ao buscar contexto: " + ctxError.message)
        const snap = contexto as ChatContextoEstoque

        // 2. System prompt
        const systemPrompt = buildSystemPrompt(snap)

        // 3. Montar contents (histórico + nova mensagem)
        const historyContents = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))

        const contents = [
          ...historyContents,
          { role: "user", parts: [{ text: texto }] },
        ]

        // 4. Chamar Gemini via Edge Function
        const data = await callGemini({
          model: MODELO,
          contents,
          tools: [TOOLS_GEMINI],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        })

        const candidate = data?.candidates?.[0]
        const parts = candidate?.content?.parts ?? []
        const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall)
        const textPart = parts.find((p: { text?: string }) => typeof p.text === "string")

        if (functionCallPart?.functionCall) {
          const call = functionCallPart.functionCall as { name: string; args: Record<string, unknown> }
          const toolName = call.name as NomeTool
          const args = call.args
          const nivel = NIVEIS_CONFIRMACAO[toolName] as NivelConfirmacao

          if (nivel === 1) {
            // Executa direto, sem confirmação
            const resultado = await executarTool(toolName, args)

            // Segundo turn: envia function response de volta
            const contents2 = [
              ...contents,
              { role: "model", parts: [{ functionCall: call }] },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name: toolName,
                      response: resultado.dados ?? { sucesso: resultado.sucesso, mensagem: resultado.mensagem },
                    },
                  },
                ],
              },
            ]
            const data2 = await callGemini({ model: MODELO, contents: contents2, tools: [TOOLS_GEMINI], systemInstruction: { parts: [{ text: systemPrompt }] } })
            const replyText = data2?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? "Feito."

            const assistantMsg: MensagemChat = {
              id: makeId(),
              role: "assistant",
              content: replyText,
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
            content: textPart?.text ?? "Sem resposta.",
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
    if (!pendingConfirmation) return
    setIsLoading(true)

    const { tool_name, tool_args, nivel } = pendingConfirmation

    try {
      const resultado = await executarTool(tool_name, tool_args)

      const { data: contexto } = await supabase.rpc("estoque_chat_contexto")
      const snap = contexto as ChatContextoEstoque
      const systemPrompt = buildSystemPrompt(snap)

      const historyContents = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))

      const contents = [
        ...historyContents,
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: tool_name,
                response: resultado.dados ?? { sucesso: resultado.sucesso, mensagem: resultado.mensagem },
              },
            },
          ],
        },
      ]

      const data = await callGemini({ model: MODELO, contents, tools: [TOOLS_GEMINI], systemInstruction: { parts: [{ text: systemPrompt }] } })
      const replyText = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? "Feito."

      const confirmedMsg: MensagemChat = {
        id: makeId(),
        role: "assistant",
        content: replyText,
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
    hasKey: true,
  }
}
