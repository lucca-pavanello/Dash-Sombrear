import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { TOOLS_GEMINI, NIVEIS_CONFIRMACAO, type NomeTool } from "./tools"
import { buildSystemPrompt } from "./systemPrompt"
import { executarTool, gerarPreviewAcao } from "./executors"
import { useChatStore } from "./store"
import type { MensagemChat, NivelConfirmacao, ChatContextoEstoque } from "./types"

const MODELO = "gemini-2.5-flash-preview-05-20"

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

function assistantMsg(content: string, toolCall?: MensagemChat["toolCall"]): MensagemChat {
  return { id: makeId(), role: "assistant", content, timestamp: new Date(), toolCall }
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

export function useChatAPI() {
  const {
    mensagens,
    adicionarMensagem,
    setLoading,
    setConfirmacaoPendente,
  } = useChatStore()

  const enviarMensagem = useCallback(
    async (texto: string) => {
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

        // 3. Montar contents (histórico + nova mensagem)
        const historyContents = mensagens
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
            const resultado = await executarTool(toolName, args)

            // Segund turn: envia function response de volta
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
            adicionarMensagem(
              assistantMsg(replyText, {
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
          adicionarMensagem(assistantMsg(textPart?.text ?? "Sem resposta."))
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
      setLoading(true)

      try {
        const resultado = await executarTool(toolName, toolArgs)

        const { data: contexto } = await supabase.rpc("estoque_chat_contexto")
        const snap = contexto as ChatContextoEstoque
        const systemPrompt = buildSystemPrompt(snap)

        const currentMsgs = useChatStore.getState().mensagens
        const historyContents = currentMsgs
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
                  name: toolName,
                  response: resultado.dados ?? { sucesso: resultado.sucesso, mensagem: resultado.mensagem },
                },
              },
            ],
          },
        ]

        const data = await callGemini({ model: MODELO, contents, tools: [TOOLS_GEMINI], systemInstruction: { parts: [{ text: systemPrompt }] } })
        const replyText = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? "Feito."

        const nivel = NIVEIS_CONFIRMACAO[toolName] as NivelConfirmacao
        adicionarMensagem(
          assistantMsg(replyText, {
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
