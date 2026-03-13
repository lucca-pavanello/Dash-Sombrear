import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Bot, Calculator, Sun, Moon, LogOut, ShieldCheck, BarChart2, ClipboardList, Table2, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useProfile, usePendingCount } from '@/hooks/useProfile'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'
import EditProfileModal from '@/components/profile/EditProfileModal'
import AvatarInitials from '@/components/shared/AvatarInitials'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { cn } from '@/lib/utils'
import { ADMIN_EMAIL } from '@/lib/constants'

const TabOrcamentos   = lazy(() => import('@/components/tabs/TabOrcamentos'))
const TabPlanilha     = lazy(() => import('@/components/tabs/TabPlanilha'))
const TabAgenteIA     = lazy(() => import('@/components/tabs/TabAgenteIA'))
const TabCotacao      = lazy(() => import('@/components/tabs/TabCotacao'))
const TabCalculoCusto = lazy(() => import('@/components/tabs/TabCalculoCusto'))
const TabPlanilhaCusto= lazy(() => import('@/components/tabs/TabPlanilhaCusto'))
const TabAnalises     = lazy(() => import('@/components/tabs/TabAnalises'))
const PainelAdmin     = lazy(() => import('@/components/admin/PainelAdmin'))

const VALID_TABS = ['calcular-orcamento', 'planilha', 'agente-ia', 'orcamentos', 'planilha-custo', 'calculo-custo', 'admin', 'analises']
const DEFAULT_TAB = 'calcular-orcamento'
const TAB_LABELS: Record<string, string> = {
  'calcular-orcamento': 'Calcular Orçamento',
  'planilha': 'Planilha Orçamento',
  'agente-ia': 'Agente IA',
  'orcamentos': 'Orçamentos',
  'planilha-custo': 'Planilha de Custo',
  'calculo-custo': 'Custo',
  'admin': 'Usuários',
  'analises': 'Análises',
}

export default function Dashboard() {
  // — state primeiro, sempre, para conformidade com Rules of Hooks —
  const [unreadCount, setUnreadCount] = useState(0)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // — router —
  const navigate = useNavigate()
  const location = useLocation()

  // — dados e tema —
  const { isDark, toggle } = useTheme()
  const { toasts, toast, dismiss } = useToast()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: pendingCount = 0 } = usePendingCount()
  const { data: orcamentos = [], isLoading, isError } = useOrcamentos((novo) => {
    toast('success', `Novo orçamento: ${novo.cliente ?? novo.responsavel}`)
    if (!document.hasFocus()) setUnreadCount((n) => n + 1)
  })

  const isAdmin = profile?.email === ADMIN_EMAIL
  const tabFromUrl = location.pathname.replace(/^\//, '') || DEFAULT_TAB
  // Enquanto o perfil carrega, não redireciona — evita flash para admins acessando /admin diretamente
  const activeTab = VALID_TABS.includes(tabFromUrl) && (tabFromUrl !== 'admin' || isAdmin || profileLoading)
    ? tabFromUrl
    : DEFAULT_TAB

  function handleTabChange(id: string) {
    navigate(`/${id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const tabLabel = TAB_LABELS[activeTab] ?? 'Sombrear'
    document.title = unreadCount > 0 ? `(${unreadCount}) ${tabLabel} — Sombrear` : `${tabLabel} — Sombrear`
  }, [unreadCount, activeTab])

  useEffect(() => {
    function handleFocus() { setUnreadCount(0) }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const TABS = [
    { id: 'calcular-orcamento', label: 'Calcular Orçamento', icon: ClipboardList, badge: 0 },
    { id: 'planilha', label: 'Planilha Orçamento', icon: Table2, badge: 0 },
    { id: 'agente-ia', label: 'Agente IA', icon: Bot, badge: 0 },
    { id: 'orcamentos', label: 'Orçamentos', icon: FileText, badge: 0 },
    { id: 'planilha-custo', label: 'Planilha de Custo', icon: Receipt, badge: 0 },
    { id: 'calculo-custo', label: 'Custo', icon: Calculator, badge: 0 },
    ...(isAdmin ? [{ id: 'admin', label: 'Usuários', icon: ShieldCheck, badge: pendingCount }] : []),
    { id: 'analises', label: 'Análises', icon: BarChart2, badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/15 bg-gradient-to-r from-card via-card to-primary/[0.04] backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-brand">
              <span className="font-display text-base font-bold text-white">S</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-none text-foreground">Sombrear</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="hidden sm:block mr-1 text-xs text-muted-foreground tabular-nums">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>

            {/* Profile button */}
            {profile && (
              <button
                onClick={() => setProfileModalOpen(true)}
                className="relative rounded-full hover:ring-2 hover:ring-primary/60 hover:ring-offset-2 hover:ring-offset-background transition-all duration-150 active:scale-95"
                title="Meu perfil"
                aria-label="Meu perfil"
              >
                <AvatarInitials name={profile.full_name || profile.email} size="sm" />
                {isAdmin && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-1 ring-background">
                    <ShieldCheck className="h-2 w-2 text-white" />
                  </span>
                )}
              </button>
            )}

            {isAdmin && pendingCount > 0 && (
              <button
                onClick={() => handleTabChange('admin')}
                className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95"
                title="Aprovações pendentes"
                aria-label="Aprovações pendentes"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              </button>
            )}
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95"
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-muted/60 p-1 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              title={label}
              className={cn(
                'relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:scale-95',
                activeTab === id
                  ? 'bg-card text-primary shadow-elevated'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              {badge > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
              {activeTab === id && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary sm:hidden" />
              )}
            </button>
          ))}
        </div>

        <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>}>
          <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {activeTab === 'planilha' && <TabPlanilha data={orcamentos} loading={isLoading} toast={toast} />}
            {activeTab === 'planilha-custo' && <TabPlanilhaCusto data={orcamentos} loading={isLoading} />}
            {activeTab === 'orcamentos' && <TabOrcamentos data={orcamentos} loading={isLoading} toast={toast} />}
            {activeTab === 'analises' && <TabAnalises data={orcamentos} isLoading={isLoading} error={isError} />}
            {activeTab === 'agente-ia' && <TabAgenteIA />}
            {activeTab === 'calcular-orcamento' && <TabCotacao />}
            {activeTab === 'calculo-custo' && <TabCalculoCusto data={orcamentos} isLoading={isLoading} error={isError} />}
            {activeTab === 'admin' && isAdmin && <PainelAdmin toast={toast} />}
          </div>
        </Suspense>
      </main>

      {profileModalOpen && profile && (
        <EditProfileModal
          mode="self"
          targetProfile={profile}
          onClose={() => setProfileModalOpen(false)}
          toast={toast}
        />
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
