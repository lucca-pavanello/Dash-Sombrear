import { useEffect, useState, useRef, lazy, Suspense, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Bot, Calculator, Sun, Moon, LogOut, ShieldCheck, BarChart2, ClipboardList, Search, Package, Volume2, VolumeX, Sparkles, Kanban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useProfile, usePendingCount } from '@/hooks/useProfile'
import { useEstoqueProdutosAlerta } from '@/hooks/useEstoqueProdutos'
import { useToast } from '@/hooks/useToast'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import Toaster from '@/components/ui/Toaster'
import CommandPalette from '@/components/shared/CommandPalette'
import EditProfileModal from '@/components/profile/EditProfileModal'
import AvatarInitials from '@/components/shared/AvatarInitials'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { cn } from '@/lib/utils'
import { ADMIN_EMAIL } from '@/lib/constants'
import { useUiSound } from '@/hooks/useUiSound'
import { usePresence } from '@/hooks/usePresence'
import AICopilot from '@/components/shared/AICopilot'

const TabOrcamentos   = lazy(() => import('@/components/tabs/TabOrcamentos'))
const TabPlanilha     = lazy(() => import('@/components/tabs/TabPlanilha'))
const TabAgenteIA     = lazy(() => import('@/components/tabs/TabAgenteIA'))
const TabCotacao      = lazy(() => import('@/components/tabs/TabCotacao'))
const TabCalculoCusto = lazy(() => import('@/components/tabs/TabCalculoCusto'))

const TabAnalises     = lazy(() => import('@/components/tabs/TabAnalises'))
const TabEstoque      = lazy(() => import('@/components/tabs/TabEstoque'))
const TabKanban       = lazy(() => import('@/components/tabs/TabKanban'))
const PainelAdmin     = lazy(() => import('@/components/admin/PainelAdmin'))

const VALID_TABS = ['calcular-orcamento', 'planilha', 'calculo-custo', 'agente-ia', 'orcamentos', 'admin', 'analises', 'estoque', 'kanban']
const DEFAULT_TAB = 'calcular-orcamento'
const TAB_LABELS: Record<string, string> = {
  'calcular-orcamento': 'Calcular Orçamento',
  'planilha': 'Planilha Orçamento',
  'calculo-custo': 'Planilha Custos',
  'agente-ia': 'Agente IA',
  'orcamentos': 'Orçamentos',
  'kanban': 'Funil',
  'admin': 'Usuários',
  'analises': 'Análises',
  'estoque': 'Estoque',
}

export default function Dashboard() {
  // — state primeiro, sempre, para conformidade com Rules of Hooks —
  const [unreadCount, setUnreadCount] = useState(0)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [splashFading, setSplashFading] = useState(false)
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 })
  const [orcPulse, setOrcPulse] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const prevUnreadRef = useRef(0)
  const tabBarRef = useRef<HTMLDivElement>(null)

  const uiSound = useUiSound()

  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    const initial = window.location.pathname.replace(/^\//, '') || DEFAULT_TAB
    return new Set([VALID_TABS.includes(initial) ? initial : DEFAULT_TAB])
  })

  // — router —
  const navigate = useNavigate()
  const location = useLocation()

  // — dados e tema —
  const { isDark, toggle } = useTheme()
  const { toasts, toast, dismiss } = useToast()
  const { open: paletteOpen, setOpen: setPaletteOpen, close: closePalette } = useCommandPalette()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: pendingCount = 0 } = usePendingCount()
  const { data: estoqueAlertas = [] } = useEstoqueProdutosAlerta()
  const { data: orcamentos = [], isLoading, isError } = useOrcamentos((novo) => {
    toast('success', `Novo orçamento: ${novo.cliente ?? novo.responsavel ?? 'sem identificação'}`)
    if (!document.hasFocus()) setUnreadCount((n) => n + 1)
  })

  const isAdmin = profile?.email === ADMIN_EMAIL || profile?.is_admin === true
  const tabFromUrl = location.pathname.replace(/^\//, '') || DEFAULT_TAB
  // Enquanto o perfil carrega, não redireciona — evita flash para admins acessando /admin diretamente
  const activeTab = VALID_TABS.includes(tabFromUrl) && (tabFromUrl !== 'admin' || isAdmin || profileLoading)
    ? tabFromUrl
    : DEFAULT_TAB
  const others = usePresence(profile ?? null, activeTab)

  function handleTabChange(id: string) {
    uiSound.play('tab')
    setUnreadCount(0)
    navigate(`/${id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleThemeToggle(e: React.MouseEvent) {
    const x = e.clientX
    const y = e.clientY
    type DocVT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    const doc = document as DocVT
    if (!doc.startViewTransition) { toggle(); return }
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const vt = doc.startViewTransition(() => { toggle() })
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 400, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }

  function handleTabRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement('span')
    ripple.className = 'tab-ripple'
    ripple.style.left = `${e.clientX - rect.left}px`
    ripple.style.top  = `${e.clientY - rect.top}px`
    btn.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
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

  // Atalhos de teclado globais
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const active = document.activeElement
      const inField = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        (active as HTMLElement).isContentEditable
      )
      if (inField) return
      // '/' → foca o campo de busca
      if (e.key === '/') {
        e.preventDefault()
        const el = document.getElementById('filter-search-input') as HTMLInputElement | null
        el?.focus()
        el?.select()
      }
      // 'n' → abre novo orçamento (apenas nas tabs planilha e orcamentos)
      if ((e.key === 'n' || e.key === 'N') && (activeTab === 'planilha' || activeTab === 'orcamentos')) {
        const btn = document.getElementById('novo-orcamento-btn') as HTMLButtonElement | null
        btn?.click()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeTab])

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev
      // Não monta a aba admin enquanto o perfil está carregando ou se não for admin
      if (activeTab === 'admin' && (profileLoading || !isAdmin)) return prev
      return new Set([...prev, activeTab])
    })
  }, [activeTab, isAdmin, profileLoading])

  useEffect(() => {
    const preload = () => {
      // Força o download dos chunks lazy das abas mais usadas
      import('@/components/tabs/TabOrcamentos')
      import('@/components/tabs/TabPlanilha')
      import('@/components/tabs/TabCotacao')
      import('@/components/tabs/TabAgenteIA')
      import('@/components/tabs/TabAnalises')
      import('@/components/tabs/TabCalculoCusto')

      import('@/components/admin/PainelAdmin')
      import('@/components/tabs/TabEstoque')
      import('@/components/tabs/TabKanban')
    }
    if ('requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, opts?: object) => number })
        .requestIdleCallback(preload, { timeout: 3000 })
      return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
    } else {
      const t = setTimeout(preload, 2000)
      return () => clearTimeout(t)
    }
  }, [])

  // ── Splash screen: some quando dados carregam ──
  useEffect(() => {
    if (!isLoading && showSplash) {
      setSplashFading(true)
      const t = setTimeout(() => setShowSplash(false), 400)
      return () => clearTimeout(t)
    }
  }, [isLoading, showSplash])


  // ── Badge pulse no tab Orçamentos quando novo orçamento chega ──
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setOrcPulse(true)
      const t = setTimeout(() => setOrcPulse(false), 600)
      return () => clearTimeout(t)
    }
    prevUnreadRef.current = unreadCount
  }, [unreadCount])

  // ── Parallax background orbs ──
  useEffect(() => {
    function onScroll() { setScrollY(window.scrollY) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Favicon badge ──
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')!
    // Draw orange rounded square
    const r = 12
    const [x, y, w, h] = [2, 2, 60, 60]
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
    ctx.fillStyle = '#E8701A'
    ctx.fill()
    ctx.fillStyle = 'white'
    ctx.font = 'bold 40px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('S', 32, 35)
    if (unreadCount > 0) {
      ctx.beginPath()
      ctx.arc(51, 13, 13, 0, Math.PI * 2)
      ctx.fillStyle = '#EF4444'
      ctx.fill()
      ctx.fillStyle = 'white'
      ctx.font = 'bold 13px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(unreadCount > 9 ? '9+' : String(unreadCount), 51, 13)
    }
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = canvas.toDataURL()
  }, [unreadCount])


  // ── Sliding tab indicator ──
  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    requestAnimationFrame(() => {
      const activeBtn = bar.querySelector(`[data-tab="${activeTab}"]`) as HTMLButtonElement | null
      if (!activeBtn) return
      const barRect = bar.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      setTabIndicator({
        left: btnRect.left - barRect.left + bar.scrollLeft,
        width: btnRect.width,
      })
    })
  }, [activeTab])

  const TABS = useMemo(() => [
    { id: 'calcular-orcamento', label: 'Calcular Orçamento', icon: Calculator, badge: 0 },
    { id: 'planilha', label: 'Planilha Orçamento', icon: ClipboardList, badge: 0 },
    { id: 'calculo-custo', label: 'Planilha Custos', icon: ClipboardList, badge: 0 },
    { id: 'analises', label: 'Análises', icon: BarChart2, badge: 0 },
    { id: 'kanban', label: 'Funil', icon: Kanban, badge: 0 },
    { id: 'agente-ia', label: 'Agente IA', icon: Bot, badge: 0 },
    { id: 'orcamentos', label: 'Orçamentos', icon: FileText, badge: 0 },
    { id: 'estoque', label: 'Estoque', icon: Package, badge: estoqueAlertas.length },
    ...(isAdmin ? [{ id: 'admin', label: 'Usuários', icon: ShieldCheck, badge: pendingCount }] : []),
  ], [isAdmin, pendingCount, estoqueAlertas.length])

  function MagneticBtn({ children, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const [off, setOff] = useState({ x: 0, y: 0 })
    function onMove(e: React.MouseEvent<HTMLButtonElement>) {
      const r = e.currentTarget.getBoundingClientRect()
      setOff({ x: (e.clientX - (r.left + r.width / 2)) * 0.38, y: (e.clientY - (r.top + r.height / 2)) * 0.38 })
    }
    function onLeave() { setOff({ x: 0, y: 0 }) }
    const isResting = off.x === 0 && off.y === 0
    return (
      <button
        {...props}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ transform: `translate(${off.x}px,${off.y}px)`, transition: isResting ? 'transform 300ms ease' : 'transform 80ms ease', ...style }}
      >
        {children}
      </button>
    )
  }

  function TabSkeleton() {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  return (
    <>
    {/* ── Splash Screen ── */}
    {showSplash && (
      <div
        className={cn(
          'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background',
          splashFading && 'splash-overlay-out',
        )}
      >
        <div className="splash-icon-pulse flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-brand">
          <span className="font-display text-3xl font-bold text-white">S</span>
        </div>
        <h2 className="mt-5 font-display text-xl font-bold text-foreground">Sombrear</h2>
        <p className="mt-1 text-sm text-muted-foreground">Carregando dados...</p>
        <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="splash-progress-bar h-1 rounded-full bg-primary" />
        </div>
      </div>
    )}

    <div className="min-h-screen bg-background">
      {/* Background: dot grid + orbs de glassmorphism */}
      <div className="dot-grid fixed inset-0 -z-10 pointer-events-none" />
      <div
        className="fixed -z-10 pointer-events-none -top-40 -right-40 h-[550px] w-[550px] rounded-full bg-primary/[0.06] dark:bg-primary/[0.10] blur-3xl"
        style={{ transform: `translateY(${scrollY * 0.15}px)` }}
      />
      <div
        className="fixed -z-10 pointer-events-none -bottom-40 -left-40 h-[650px] w-[650px] rounded-full bg-amber-400/[0.05] dark:bg-amber-400/[0.08] blur-3xl"
        style={{ transform: `translateY(${-scrollY * 0.10}px)` }}
      />

      {/* Header */}
      <header className="header-aurora sticky top-0 z-50 overflow-hidden border-b border-primary/15 bg-gradient-to-r from-card via-card to-primary/[0.04] backdrop-blur-md shadow-sm">
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
            {/* Busca global Cmd+K */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 mr-1"
              title="Busca global (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar...</span>
              <kbd className="hidden md:flex h-4 items-center rounded border border-border bg-background px-1 text-[9px] font-mono">⌘K</kbd>
            </button>

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
            {/* Live presence avatars */}
            {others.length > 0 && (
              <div className="hidden sm:flex items-center mr-1" title={others.map(u => `${u.name} está em ${TAB_LABELS[u.tab] ?? u.tab}`).join('\n')}>
                {others.slice(0, 3).map((u, idx) => (
                  <div key={u.id} className="relative ring-2 ring-emerald-400 rounded-full" style={{ marginLeft: idx === 0 ? 0 : '-6px', zIndex: 3 - idx }}>
                    <AvatarInitials name={u.name} size="sm" />
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-background" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                  </div>
                ))}
                {others.length > 3 && (
                  <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">+{others.length - 3}</span>
                )}
              </div>
            )}

            {/* AI Copilot button */}
            <MagneticBtn
              onClick={() => setCopilotOpen(v => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors duration-150 active:scale-95',
                copilotOpen
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label="Copilot IA"
              title="Copilot Sombrear (IA)"
            >
              <Sparkles className="h-4 w-4" />
            </MagneticBtn>

            <MagneticBtn
              onClick={uiSound.toggle}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 active:scale-95"
              aria-label={uiSound.enabled ? 'Desativar sons' : 'Ativar sons'}
              title={uiSound.enabled ? 'Sons ativos' : 'Sons desativados'}
            >
              {uiSound.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </MagneticBtn>
            <MagneticBtn
              onClick={handleThemeToggle}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 active:scale-95"
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </MagneticBtn>
            <MagneticBtn
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 active:scale-95"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </MagneticBtn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        {/* Tabs */}
        <div ref={tabBarRef} className="mb-6 relative flex gap-1 rounded-xl bg-muted/60 p-1 overflow-x-auto scrollbar-none">
          {/* Sliding underline indicator */}
          {tabIndicator.width > 0 && (
            <div
              className="tab-indicator pointer-events-none absolute bottom-1.5 h-0.5 rounded-full bg-primary/70"
              style={{ left: tabIndicator.left + 6, width: tabIndicator.width - 12 }}
            />
          )}
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              data-tab={id}
              onClick={() => handleTabChange(id)}
              onMouseDown={handleTabRipple}
              title={label}
              className={cn(
                'relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-100 whitespace-nowrap active:scale-95',
                activeTab === id
                  ? 'bg-card text-primary shadow-elevated'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              {badge > 0 && (
                <span className="flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {/* Pulse ring quando novo orçamento chega */}
              {id === 'orcamentos' && orcPulse && activeTab !== 'orcamentos' && (
                <span className="badge-ping-once absolute inset-0 rounded-lg border-2 border-primary/60 pointer-events-none" />
              )}
              {activeTab === id && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary sm:hidden" />
              )}
            </button>
          ))}
        </div>

        <div>
          {mountedTabs.has('calcular-orcamento') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'calcular-orcamento' ? 'tab-active' : 'tab-hidden'}>
                <TabCotacao />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('planilha') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'planilha' ? 'tab-active' : 'tab-hidden'}>
                <TabPlanilha data={orcamentos} loading={isLoading} toast={toast} />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('agente-ia') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'agente-ia' ? 'tab-active' : 'tab-hidden'}>
                <TabAgenteIA />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('orcamentos') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'orcamentos' ? 'tab-active' : 'tab-hidden'}>
                <TabOrcamentos data={orcamentos} loading={isLoading} />
              </div>
            </Suspense>
          )}
{mountedTabs.has('calculo-custo') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'calculo-custo' ? 'tab-active' : 'tab-hidden'}>
                <TabCalculoCusto isLoading={isLoading} error={isError} toast={toast} />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('analises') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'analises' ? 'tab-active' : 'tab-hidden'}>
                <TabAnalises data={orcamentos} isLoading={isLoading} error={isError} />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('kanban') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'kanban' ? 'tab-active' : 'tab-hidden'}>
                <TabKanban data={orcamentos} />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('estoque') && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'estoque' ? 'tab-active' : 'tab-hidden'}>
                <TabEstoque toast={toast} />
              </div>
            </Suspense>
          )}
          {mountedTabs.has('admin') && isAdmin && (
            <Suspense fallback={<TabSkeleton />}>
              <div className={activeTab === 'admin' ? 'tab-active' : 'tab-hidden'}>
                <PainelAdmin toast={toast} />
              </div>
            </Suspense>
          )}
        </div>
      </main>

      {profileModalOpen && profile && (
        <EditProfileModal
          mode="self"
          targetProfile={profile}
          onClose={() => setProfileModalOpen(false)}
          toast={toast}
        />
      )}

      <CommandPalette open={paletteOpen} onClose={closePalette} orcamentos={orcamentos} />

      <Toaster toasts={toasts} onDismiss={dismiss} />

      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} data={orcamentos} />
    </div>
    </>
  )
}
