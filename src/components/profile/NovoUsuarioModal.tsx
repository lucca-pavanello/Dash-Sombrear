import { useState, useEffect, useRef } from 'react'
import { X, User, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import SectionDivider from '@/components/shared/SectionDivider'

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

interface Props {
  onClose: () => void
  toast: (type: 'success' | 'error', message: string) => void
}

export default function NovoUsuarioModal({ onClose, toast }: Props) {
  const qc = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) { toast('error', 'Email obrigatório.'); return }
    if (password.length < 6) { toast('error', 'Senha deve ter pelo menos 6 caracteres.'); return }

    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: email.trim(), password, full_name: fullName.trim() },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profiles-pending-count'] })
      toast('success', `Usuário ${fullName || email} criado com sucesso!`)
      onClose()
    } catch (err) {
      console.error('[NovoUsuarioModal]', err)
      toast('error', err instanceof Error ? err.message : 'Erro ao criar usuário.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-novo-usuario"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-brand">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="modal-title-novo-usuario" className="font-display text-base font-semibold">
              Novo usuário
            </h2>
            <p className="text-xs text-muted-foreground">Criar conta e aprovar automaticamente</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          <SectionDivider label="Dados do usuário" />

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><User className="h-3 w-3" />Nome completo</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Nome completo (opcional)"
            />
          </div>

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="usuario@email.com"
            />
          </div>

          <SectionDivider label="Senha inicial" />

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" />Senha</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputClass, 'pr-10')}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              O usuário poderá alterar a senha depois no próprio perfil.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
