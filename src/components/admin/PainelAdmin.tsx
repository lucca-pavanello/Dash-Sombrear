import { useState } from 'react'
import { useAllProfiles } from '@/hooks/useProfile'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Check, X, Users, CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/constants'
import type { Profile } from '@/hooks/useProfile'
import EditProfileModal from '@/components/profile/EditProfileModal'

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
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-yellow-500/20 px-5 py-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-medium tracking-wide">Aguardando aprovação</h2>
            <span className="ml-auto rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
              {pendentes.length}
            </span>
          </div>
          <div className="divide-y">
            {pendentes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditingProfile(p)}
                    title="Editar perfil"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setPendingId(p.id)
                      try { await approve.mutateAsync({ id: p.id, approved: true }) }
                      finally { setPendingId(null) }
                    }}
                    disabled={pendingId === p.id}
                    title="Aprovar"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                  >
                    {pendingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={async () => {
                      setPendingId(p.id)
                      try { await approve.mutateAsync({ id: p.id, approved: false }) }
                      finally { setPendingId(null) }
                    }}
                    disabled={pendingId === p.id}
                    title="Recusar"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    {pendingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aprovados */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-medium tracking-wide">Usuários aprovados</h2>
          <span className="ml-auto rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600">
            {aprovados.length}
          </span>
        </div>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : aprovados.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário aprovado ainda.</div>
        ) : (
          <div className="divide-y">
            {aprovados.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditingProfile(p)}
                    title="Editar perfil"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {p.email !== ADMIN_EMAIL && (
                    <button
                      onClick={async () => {
                        setPendingId(p.id)
                        try { await approve.mutateAsync({ id: p.id, approved: false }) }
                        finally { setPendingId(null) }
                      }}
                      disabled={pendingId === p.id}
                      title="Revogar acesso"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {pendingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
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
