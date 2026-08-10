import { useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register' | 'forgot'

const INPUT_CLS = 'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const LABEL_CLS = 'mb-1.5 block text-sm font-medium'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function trocarModo(m: Mode) {
    setMode(m)
    setMessage(null)
    setShowPassword(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ type: 'error', text: 'Email ou senha incorretos.' })
    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setMessage({ type: 'error', text: error.message })
      else setMessage({ type: 'success', text: 'Conta criada! Aguarde aprovação do administrador.' })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setMessage({ type: 'error', text: error.message })
      else setMessage({ type: 'success', text: 'Email de redefinição enviado!' })
    }

    setLoading(false)
  }

  const labelBotao = loading
    ? (mode === 'login' ? 'Entrando…' : mode === 'register' ? 'Criando conta…' : 'Enviando…')
    : (mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link de redefinição')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      {/* Background: dot grid + orbs (mesma linguagem do dashboard) */}
      <div className="dot-grid pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-brand/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-brand">
            <span className="font-display text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Sombrear Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão de performance</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-elevated">
          {/* Tabs Entrar/Cadastrar */}
          {mode !== 'forgot' && (
            <div className="mb-6 flex rounded-xl bg-muted p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => trocarModo(m)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    mode === m
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'login' ? 'Entrar' : 'Cadastrar'}
                </button>
              ))}
            </div>
          )}

          {/* Cabeçalho do modo esqueci a senha */}
          {mode === 'forgot' && (
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Redefinir senha</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Enviaremos um link de redefinição para o seu email.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" key={mode}>
            {mode === 'register' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label htmlFor="login-nome" className={LABEL_CLS}>Nome completo</label>
                <input
                  id="login-nome"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={INPUT_CLS}
                  placeholder="Seu nome"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-email" className={LABEL_CLS}>Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={INPUT_CLS}
                placeholder="seu@email.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="login-senha" className={LABEL_CLS}>Senha</label>
                <div className="relative">
                  <input
                    id="login-senha"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={cn(INPUT_CLS, 'pr-11')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div aria-live="polite">
              {message && (
                <div className={cn(
                  'flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200',
                  message.type === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                )}>
                  {message.type === 'error'
                    ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                  {message.text}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-3 text-sm font-semibold text-white shadow-brand transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {labelBotao}
            </button>
          </form>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => trocarModo('forgot')}
              className="mt-4 w-full rounded-lg py-1 text-center text-xs text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              Esqueci minha senha
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => trocarModo('login')}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-center text-xs text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
