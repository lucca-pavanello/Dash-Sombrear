import { useState } from 'react'
import { useAllProfiles } from '@/hooks/useProfile'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Check, X, CheckCircle2, Loader2, Pencil, ShieldCheck, Clock } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/constants'
import type { Profile } from '@/hooks/useProfile'
import EditProfileModal from '@/components/profile/EditProfileModal'
import AvatarInitials from '@/components/shared/AvatarInitials'

interface Props {
  toast: (type: 'success' | 'error', message: string) => void
}

export default function PainelAdmin({ toast }: Props) {
  const { data: profiles = [], isLoading } = useAllProfiles()
  const qc = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)

  const approve = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from('profiles').update({ approved }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profiles-pending-count'] })
      toast('success', vars.approved ? 'Usuário aprovado!' : 'Acesso revogado.')
    },
    onError: (err) => { console.error('[PainelAdmin] mutation error:', err); toast('error', 'Erro ao atualizar usuário.') },
  })

  const pendentes = profiles.filter((p) => p.approved === null)
  const aprovados = profiles.filter((p) => p.approved === true)

  return (
    <div className="space-y-6">

      {/* Stats resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Total de usuários</p>
          <p className="font-display mt-1 text-2xl font-bold text-primary">{profiles.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Aprovados</p>
          <p className="font-display mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{aprovados.length}</p>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Pendentes</p>
          <p className="font-display mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendentes.length}</p>
        </div>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-yellow-500/20 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/15">
              <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="font-display text-sm font-semibold tracking-wide">Aguardando aprovação</h2>
            <span className="ml-auto rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-bold text-yellow-700 dark:text-yellow-400">
              {pendentes.length}
            </span>
          </div>
          <div className="divide-y divide-yellow-500/10">
            {pendentes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarInitials name={p.full_name || p.email} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">{p.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditingProfile(p)}
                    title="Editar perfil"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      setPendingId(p.id)
                      try { await approve.mutateAsync({ id: p.id, approved: true }) }
                      finally { setPendingId(null) }
                    }}
                    disabled={pendingId === p.id}
                    title="Aprovar"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                  >
                    {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={async () => {
                      setPendingId(p.id)
                      try { await approve.mutateAsync({ id: p.id, approved: false }) }
                      finally { setPendingId(null) }
                    }}
                    disabled={pendingId === p.id}
                    title="Recusar"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aprovados */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="font-display text-sm font-semibold tracking-wide">Usuários aprovados</h2>
          <span className="ml-auto rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
            {aprovados.length}
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : aprovados.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum usuário aprovado ainda.</div>
        ) : (
          <div className="divide-y">
            {aprovados.map((p) => {
              const isAdminUser = p.email === ADMIN_EMAIL
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3.5 transition-colors ${isAdminUser ? 'bg-brand-gradient/[0.06] border-l-2 border-l-primary' : 'hover:bg-muted/30'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <AvatarInitials name={p.full_name || p.email} size="md" />
                      {isAdminUser && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-sm">
                          <ShieldCheck className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{p.full_name || 'Sem nome'}</p>
                        {isAdminUser && (
                          <span className="shrink-0 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold text-white shadow-brand">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditingProfile(p)}
                      title="Editar perfil"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!isAdminUser && (
                      <button
                        onClick={async () => {
                          setPendingId(p.id)
                          try { await approve.mutateAsync({ id: p.id, approved: false }) }
                          finally { setPendingId(null) }
                        }}
                        disabled={pendingId === p.id}
                        title="Revogar acesso"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editingProfile && (
        <EditProfileModal
          mode="admin"
          targetProfile={editingProfile}
          onClose={() => setEditingProfile(null)}
          toast={toast}
        />
      )}
    </div>
  )
}
