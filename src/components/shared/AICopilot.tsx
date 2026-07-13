import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { X, Send, Sparkles, RotateCcw, ExternalLink, Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGemini, buildGeminiContext } from '@/hooks/useGemini'
import type { Orcamento } from '@/lib/supabase'

const SUGGESTIONS = [
  'Qual modelo devo focar este mês?',
  'Quem tem mais chance de fechar agora?',
  'Como está minha margem comparada ao mês anterior?',
  'Tem algum lead em risco que devo contatar hoje?',
]

interface Props {
  open: boolean
  onClose: () => void
  data: Orcamento[]
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-1 px-3 py-2.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

// ── Web Speech API types ──────────────────────────────────────────
type SpeechRecognitionAny = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } }; length: number } }) => void
  onerror: () => void
  onend: () => void
  start: () => void
  stop: () => void
  abort: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionAny
    webkitSpeechRecognition?: new () => SpeechRecognitionAny
  }
}

const hasSpeech = typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)

function AICopilot({ open, onClose, data }: Props) {
  const { messages, isLoading, sendMessage, clearChat, hasKey } = useGemini()
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionAny | null>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    const ctx = buildGeminiContext(data)
    sendMessage(text, ctx)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSuggestion(s: string) {
    const ctx = buildGeminiContext(data)
    sendMessage(s, ctx)
  }

  const toggleVoice = useCallback(() => {
    if (!hasSpeech) return
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev ? prev + ' ' + transcript : transcript)
    }
    rec.onerror = () => { setIsListening(false) }
    rec.onend = () => { setIsListening(false) }
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [isListening])

  // Stop recognition when panel closes
  useEffect(() => {
    if (!open && isListening) {
      recognitionRef.current?.abort()
      setIsListening(false)
    }
  }, [open, isListening])

  if (!open) return null

  return (
    <>
      {/* Backdrop sutil */}
      <div className="fixed inset-0 z-[489]" onClick={onClose} />

      <div className={cn(
        'fixed bottom-20 right-4 z-[490] flex flex-col',
        'w-[360px] max-h-[560px] min-h-[200px]',
        'rounded-2xl border-2 border-primary/20 bg-card shadow-2xl',
        'dark:bg-card/90 dark:backdrop-blur-xl',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
      )}>
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3 rounded-t-2xl bg-primary/[0.04]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none">Copilot Sombrear</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Powered by Gemini 1.5 Flash</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Limpar conversa"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Fechar (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Sem chave configurada */}
        {!hasKey ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-xl bg-muted/60 p-3">
              <Sparkles className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold">Chave Gemini não configurada</p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Adicione <code className="rounded bg-muted px-1 py-0.5 text-[11px]">VITE_GEMINI_API_KEY</code> no arquivo <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code>
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Obter chave gratuita
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <>
            {/* Área de mensagens */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
              {messages.length === 0 && !isLoading && (
                <div className="space-y-3">
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    Olá! Pergunta algo sobre os dados do dashboard.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors leading-snug"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto bg-primary text-white rounded-br-sm'
                      : 'mr-auto bg-muted/70 text-foreground rounded-bl-sm',
                    'animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
                  )}
                >
                  {m.text}
                </div>
              ))}

              {isLoading && (
                <div className="mr-auto bg-muted/70 rounded-2xl rounded-bl-sm animate-in fade-in duration-150">
                  <TypingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/60 p-3">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:border-primary/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo… (Enter para enviar)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-24"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                {hasSpeech && (
                  <button
                    onClick={toggleVoice}
                    className={cn(
                      'shrink-0 rounded-lg p-1.5 transition-all active:scale-95',
                      isListening
                        ? 'bg-rose-500/15 text-rose-500 animate-pulse'
                        : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted'
                    )}
                    title={isListening ? 'Parar gravação' : 'Ditado por voz (pt-BR)'}
                    aria-label={isListening ? 'Parar gravação' : 'Falar'}
                  >
                    {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 rounded-lg bg-primary p-1.5 text-white disabled:opacity-40 hover:bg-primary/90 transition-all active:scale-95"
                  aria-label="Enviar"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default memo(AICopilot)
