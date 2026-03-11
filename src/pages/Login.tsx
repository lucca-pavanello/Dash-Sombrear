import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register' | 'forgot'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background orbs */}
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
          {/* Tabs */}
          {mode !== 'forgot' && (
            <div className="mb-6 flex rounded-xl bg-muted p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setMessage(null) }}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nome completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2"
                  placeholder="Seu nome"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2"
                placeholder="seu@email.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2"
                  placeholder="••••••••"
                />
              </div>
            )}

            {message && (
              <div className={cn(
                'rounded-lg px-4 py-3 text-sm',
                message.type === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400',
              )}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-gradient py-3 text-sm font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar email'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              onClick={() => { setMode('forgot'); setMessage(null) }}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              Esqueci minha senha
            </button>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setMessage(null) }}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
