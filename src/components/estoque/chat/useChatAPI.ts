import { useCallback } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabase } from "@/lib/supabase"
import { TOOLS_GEMINI, NIVEIS_CONFIRMACAO, type NomeTool } from "./tools"
import { buildSystemPrompt } from "./systemPrompt"
import { executarTool, gerarPreviewAcao } from "./executors"
import { useChatStore } from "./store"
import type { MensagemChat, NivelConfirmacao, ChatContextoEstoque } from "./types"

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODELO = "gemini-2.5-flash-preview-05-20"

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

function assistantMsg(content: string, toolCall?: MensagemChat["toolCall"]): MensagemChat {
  return { id: makeId(), role: "assistant", content, timestamp: new Date(), toolCall }
}

export function useChatAPI() {
  const {
    mensagens,
    adicionarMensagem,
    setLoading,
    setConfirmacaoPendente,
  } = useChatStore()

  const enviarMensagem = useCallback(
    async (texto: string) => {
      if (!API_KEY) {
        adicionarMensagem(assistantMsg("❌ API key não configurada."))
        return
      }

      adicionarMensagem({
        id: makeId(),
        role: "user",
        content: texto,
        timestamp: new Date(),
      })
      setLoading(true)

      try {
        // 1. Buscar snapshot
        const { data: contexto, error: ctxError } = await supabase.rpc("estoque_chat_contexto")
        if (ctxError) throw new Error("Erro ao buscar contexto: " + ctxError.message)
        const snap = contexto as ChatContextoEstoque

        // 2. System prompt
        const systemPrompt = buildSystemPrompt(snap)

        // 3. Gemini
        const genAI = new GoogleGenerativeAI(API_KEY)
        const model = genAI.getGenerativeModel({
          model: MODELO,
          tools: [TOOLS_GEMINI],
          systemInstruction: systemPrompt,
        })

        // 4. Histórico (state atual antes de adicionar a mensagem do usuário)
        const history = mensagens
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
            const resultado = await executarTool(toolName, args)
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
            adicionarMensagem(
              assistantMsg(followUp.response.text(), {
                nome: toolName,
                args,
                nivelConfirmacao: nivel,
                confirmada: true,
                executada: true,
                resultado,
              })
            )
          } else {
            const preview = gerarPreviewAcao(toolName, args)
            setConfirmacaoPendente({
              toolName,
              toolArgs: args,
              nivelConfirmacao: nivel as 2 | 3,
              preview,
            })
            adicionarMensagem(
              assistantMsg(
                `Vou ${toolName.replace(/_/g, " ")}. Confirme os detalhes abaixo antes de prosseguir.`,
                {
                  nome: toolName,
                  args,
                  nivelConfirmacao: nivel,
                  confirmada: false,
                  executada: false,
                }
              )
            )
          }
        } else {
          adicionarMensagem(assistantMsg(response.text()))
        }
      } catch (err) {
        console.error("useChatAPI.enviarMensagem error:", err)
        adicionarMensagem(assistantMsg("❌ Erro ao contatar a IA. Tente novamente."))
      } finally {
        setLoading(false)
      }
    },
    [mensagens, adicionarMensagem, setLoading, setConfirmacaoPendente]
  )

  const confirmarAcao = useCallback(
    async (toolName: NomeTool, toolArgs: Record<string, unknown>) => {
      if (!API_KEY) return
      setLoading(true)

      try {
        const resultado = await executarTool(toolName, toolArgs)

        // Resposta final via Gemini (snapshot atualizado)
        const { data: contexto } = await supabase.rpc("estoque_chat_contexto")
        const snap = contexto as ChatContextoEstoque
        const systemPrompt = buildSystemPrompt(snap)

        const genAI = new GoogleGenerativeAI(API_KEY)
        const model = genAI.getGenerativeModel({
          model: MODELO,
          tools: [TOOLS_GEMINI],
          systemInstruction: systemPrompt,
        })

        const currentMsgs = useChatStore.getState().mensagens
        const history = currentMsgs
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: m.content }],
          }))

        const chat = model.startChat({ history })
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

        const nivel = NIVEIS_CONFIRMACAO[toolName] as NivelConfirmacao
        adicionarMensagem(
          assistantMsg(followUp.response.text(), {
            nome: toolName,
            args: toolArgs,
            nivelConfirmacao: nivel,
            confirmada: true,
            executada: true,
            resultado,
          })
        )
      } catch (err) {
        console.error("useChatAPI.confirmarAcao error:", err)
        adicionarMensagem(assistantMsg("❌ Erro ao executar a ação. Tente novamente."))
      } finally {
        setConfirmacaoPendente(null)
        setLoading(false)
      }
    },
    [adicionarMensagem, setLoading, setConfirmacaoPendente]
  )

  const cancelarAcao = useCallback(() => {
    adicionarMensagem(assistantMsg("Ok, ação cancelada."))
    setConfirmacaoPendente(null)
  }, [adicionarMensagem, setConfirmacaoPendente])

  return { enviarMensagem, confirmarAcao, cancelarAcao }
}
