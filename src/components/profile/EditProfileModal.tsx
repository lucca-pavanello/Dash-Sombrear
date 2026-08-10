import { useState, useEffect, useRef } from 'react'
import { X, User, Lock, Mail, Send, Eye, EyeOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import SectionDivider from '@/components/shared/SectionDivider'
import AvatarInitials from '@/components/shared/AvatarInitials'

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

interface Props {
  mode: 'self' | 'admin'
  targetProfile: Profile
  onClose: () => void
  toast: (type: 'success' | 'error', message: string) => void
}

export default function EditProfileModal({ mode, targetProfile, onClose, toast }: Props) {
  const qc = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)

  const [fullName, setFullName] = useState(targetProfile.full_name ?? '')
  const [email, setEmail] = useState(targetProfile.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const initialName = targetProfile.full_name ?? ''
  const initialEmail = targetProfile.email ?? ''
  const isDirty =
    fullName !== initialName ||
    (mode === 'self' && email !== initialEmail) ||
    password !== '' ||
    confirmPassword !== ''

  function handleClose() {
    if (isDirty && !window.confirm('Há alterações não salvas. Deseja descartar?')) return
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password && password.length < 6) {
      toast('error', 'A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password && password !== confirmPassword) {
      toast('error', 'As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    try {
      // Step 1: update full_name in profiles if changed
      if (fullName !== initialName) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', targetProfile.id)
        if (error) throw new Error(`Nome: ${error.message}`)
      }

      // Step 2 (self only): update email if changed
      if (mode === 'self' && email !== initialEmail) {
        const { error } = await supabase.auth.updateUser({ email })
        if (error) throw new Error(`Email: ${error.message}`)
      }

      // Step 3 (self only): update password if provided
      if (mode === 'self' && password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(`Senha: ${error.message}`)
      }

      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })

      const parts: string[] = []
      if (fullName !== initialName) parts.push('nome')
      if (mode === 'self' && email !== initialEmail) parts.push('email')
      if (mode === 'self' && password) parts.push('senha')

      if (mode === 'self' && email !== initialEmail) {
        toast('success', 'Verifique seu novo email para confirmar a alteração.')
      } else {
        toast('success', parts.length > 0 ? `${parts.join(', ')} atualizado${parts.length > 1 ? 's' : ''}!` : 'Sem alterações.')
      }
      onClose()
    } catch (err) {
      console.error('[EditProfileModal] submit error:', err)
      toast('error', err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResetPassword() {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetProfile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
      toast('success', `Email de redefinição enviado para ${targetProfile.email}`)
    } catch (err) {
      console.error('[EditProfileModal] reset error:', err)
      toast('error', 'Erro ao enviar email de redefinição.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-profile"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4 shrink-0">
          <AvatarInitials name={targetProfile.full_name || targetProfile.email} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="modal-title-profile" className="font-display text-base font-semibold truncate">
                {mode === 'self' ? 'Meu Perfil' : (targetProfile.full_name || targetProfile.email)}
              </h2>
              {isDirty && (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  não salvo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{targetProfile.email}</p>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Dados pessoais */}
          <SectionDivider label="Dados pessoais" />

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><User className="h-3 w-3" />Nome completo</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</span>
            </label>
            {mode === 'self' ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="seu@email.com"
              />
            ) : (
              <div className={cn(inputClass, 'bg-muted/30 text-muted-foreground cursor-not-allowed select-all')}>
                {targetProfile.email}
              </div>
            )}
            {mode === 'self' && email !== initialEmail && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                Você receberá um email de confirmação no novo endereço.
              </p>
            )}
          </div>

          {/* Segurança */}
          <SectionDivider label="Segurança" />

          {mode === 'self' ? (
            <>
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" />Nova senha</span>
                  <span className="ml-1.5 font-normal normal-case text-muted-foreground/60 tracking-normal">
                    — deixe em branco para não alterar
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
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
              </div>

              {password && (
                <div>
                  <label className={labelClass}>Confirmar nova senha</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      inputClass,
                      confirmPassword && password !== confirmPassword && 'border-destructive focus:border-destructive'
                    )}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">As senhas não coincidem.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Como administrador, você pode enviar um link de redefinição de senha para este usuário.
              </p>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isLoading || resetSent}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150',
                  resetSent
                    ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 cursor-default'
                    : 'hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary text-muted-foreground disabled:opacity-50'
                )}
              >
                <Send className="h-4 w-4" />
                {resetSent ? 'Email enviado!' : 'Enviar link de redefinição de senha'}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !isDirty}
              className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
