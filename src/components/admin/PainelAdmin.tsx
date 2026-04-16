import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Check, X, CheckCircle2, Loader2, Pencil, ShieldCheck, ShieldOff, Clock, UserPlus, UserX } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/constants'
import type { Profile } from '@/hooks/useProfile'
import EditProfileModal from '@/components/profile/EditProfileModal'
import NovoUsuarioModal from '@/components/profile/NovoUsuarioModal'
import AvatarInitials from '@/components/shared/AvatarInitials'

interface Props {
  toast: (type: 'success' | 'error', message: string) => void
}

export default function PainelAdmin({ toast }: Props) {
  const qc = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [showNovoUsuario, setShowNovoUsuario] = useState(false)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Profile[]
    },
  })

  const approve = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean | null }) => {
      const { error } = await supabase.from('profiles').update({ approved }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profiles-pending-count'] })
      if (vars.approved === true) toast('success', 'Usuário aprovado!')
      else if (vars.approved === false) toast('success', 'Acesso revogado.')
      else toast('success', 'Usuário movido para pendente.')
    },
    onError: (err) => { console.error('[PainelAdmin]', err); toast('error', 'Erro ao atualizar usuário.') },
  })

  const toggleAdmin = useMutation({
    mutationFn: async ({ id, is_admin }: { id: string; is_admin: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_admin }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast('success', vars.is_admin ? 'Admin concedido!' : 'Admin revogado.')
    },
    onError: (err) => { console.error('[PainelAdmin]', err); toast('error', 'Erro ao alterar permissão de admin.') },
  })

  const pendentes = profiles.filter((p) => p.approved === null)
  const aprovados = profiles.filter((p) => p.approved === true)
  const revogados = profiles.filter((p) => p.approved === false)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Gerenciar Usuários</h2>
          <p className="text-xs text-muted-foreground">{profiles.length} usuário{profiles.length !== 1 ? 's' : ''} cadastrado{profiles.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNovoUsuario(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 transition-opacity active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: profiles.length },
          { label: 'Aprovados', value: aprovados.length },
          { label: 'Pendentes', value: pendentes.length },
          { label: 'Revogados', value: revogados.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border-2 border-primary/20 bg-primary/10 dark:bg-primary/15 p-4 shadow-sm flex flex-col items-center text-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className="font-display text-2xl font-bold text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 border-b px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h2 className="font-display text-sm font-semibold tracking-wide">Aguardando aprovação</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {pendentes.length}
            </span>
          </div>
          <div className="divide-y">
            {pendentes.map((p) => (
              <UserRow
                key={p.id}
                p={p}
                pendingId={pendingId}
                onEdit={() => setEditingProfile(p)}
                onApprove={async () => {
                  setPendingId(p.id)
                  try { await approve.mutateAsync({ id: p.id, approved: true }) }
                  finally { setPendingId(null) }
                }}
                onRevoke={async () => {
                  setPendingId(p.id)
                  try { await approve.mutateAsync({ id: p.id, approved: false }) }
                  finally { setPendingId(null) }
                }}
                showApprove
                showRevoke
              />
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
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {aprovados.length}
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Carregando...
          </div>
        ) : aprovados.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum usuário aprovado ainda.</div>
        ) : (
          <div className="divide-y">
            {aprovados.map((p) => {
              const isAdminUser = p.email === ADMIN_EMAIL
              return (
                <UserRow
                  key={p.id}
                  p={p}
                  isAdminUser={isAdminUser}
                  pendingId={pendingId}
                  onEdit={() => setEditingProfile(p)}
                  onToggleAdmin={isAdminUser ? undefined : async () => {
                    setPendingId(p.id)
                    try { await toggleAdmin.mutateAsync({ id: p.id, is_admin: !p.is_admin }) }
                    finally { setPendingId(null) }
                  }}
                  onRevoke={isAdminUser ? undefined : async () => {
                    setPendingId(p.id)
                    try { await approve.mutateAsync({ id: p.id, approved: false }) }
                    finally { setPendingId(null) }
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Revogados */}
      {revogados.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 border-b px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
              <UserX className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h2 className="font-display text-sm font-semibold tracking-wide">Acesso revogado</h2>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
              {revogados.length}
            </span>
          </div>
          <div className="divide-y">
            {revogados.map((p) => (
              <UserRow
                key={p.id}
                p={p}
                pendingId={pendingId}
                onEdit={() => setEditingProfile(p)}
                onApprove={async () => {
                  setPendingId(p.id)
                  try { await approve.mutateAsync({ id: p.id, approved: true }) }
                  finally { setPendingId(null) }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {editingProfile && (
        <EditProfileModal
          mode="admin"
          targetProfile={editingProfile}
          onClose={() => setEditingProfile(null)}
          toast={toast}
        />
      )}
      {showNovoUsuario && (
        <NovoUsuarioModal
          onClose={() => setShowNovoUsuario(false)}
          toast={toast}
        />
      )}
    </div>
  )
}

interface UserRowProps {
  p: Profile
  isAdminUser?: boolean
  pendingId: string | null
  onEdit: () => void
  onApprove?: () => void
  onRevoke?: () => void
  onToggleAdmin?: () => void
  showApprove?: boolean
  showRevoke?: boolean
}

function UserRow({ p, isAdminUser, pendingId, onEdit, onApprove, onRevoke, onToggleAdmin }: UserRowProps) {
  const isBusy = pendingId === p.id
  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-3.5 transition-colors ${isAdminUser ? 'border-l-2 border-l-primary bg-primary/[0.03]' : 'hover:bg-muted/20'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <AvatarInitials name={p.full_name || p.email} size="md" />
          {isAdminUser && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-sm ring-1 ring-background">
              <ShieldCheck className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-sm truncate">{p.full_name || 'Sem nome'}</p>
            {isAdminUser && (
              <span className="shrink-0 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold text-white shadow-brand">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{p.email}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onEdit}
          title="Editar perfil"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={isBusy}
            title="Aprovar"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        )}
        {onToggleAdmin && (
          <button
            onClick={onToggleAdmin}
            disabled={isBusy}
            title={p.is_admin ? 'Revogar admin' : 'Tornar admin'}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
              p.is_admin
                ? 'bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
          >
            {p.is_admin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          </button>
        )}
        {onRevoke && (
          <button
            onClick={onRevoke}
            disabled={isBusy}
            title="Revogar acesso"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}
