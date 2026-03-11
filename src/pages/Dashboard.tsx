import { useState, useEffect } from 'react'
import { FileText, Bot, Calculator, Sun, Moon, LogOut, ShieldCheck, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useProfile, usePendingCount } from '@/hooks/useProfile'
import { useToast } from '@/hooks/useToast'
import TabOrcamentos from '@/components/tabs/TabOrcamentos'
import TabAgenteIA from '@/components/tabs/TabAgenteIA'
import TabCalculoCusto from '@/components/tabs/TabCalculoCusto'
import TabAnalises from '@/components/tabs/TabAnalises'
import PainelAdmin from '@/components/admin/PainelAdmin'
import Toaster from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { ADMIN_EMAIL } from '@/lib/constants'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('orcamentos')
  const [unreadCount, setUnreadCount] = useState(0)
  const { isDark, toggle } = useTheme()
  const { toasts, toast, dismiss } = useToast()
  const { data: orcamentos = [], isLoading, isError } = useOrcamentos((novo) => {
    toast('success', `Novo orçamento: ${novo.cliente ?? novo.responsavel}`)
    if (!document.hasFocus()) setUnreadCount((n) => n + 1)
  })

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Sombrear` : 'Sombrear'
  }, [unreadCount])

  useEffect(() => {
    function handleFocus() { setUnreadCount(0) }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])
  const { data: profile } = useProfile()
  const isAdmin = profile?.email === ADMIN_EMAIL
  const { data: pendingCount = 0 } = usePendingCount()

  const TABS = [
    { id: 'orcamentos', label: 'Orçamentos', icon: FileText, badge: 0 },
    { id: 'agente-ia', label: 'Agente IA', icon: Bot, badge: 0 },
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-brand transition-transform duration-200 hover:scale-110 cursor-default">
              <span className="font-display text-base font-bold text-white">S</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-none text-foreground">Sombrear</h1>
              <p className="text-xs text-muted-foreground">
                {profile?.full_name ? profile.full_name.split(' ')[0] : 'Dashboard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isAdmin && pendingCount > 0 && (
              <button
                onClick={() => setActiveTab('admin')}
                className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95"
                title="Aprovações pendentes"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              </button>
            )}
            <button onClick={toggle} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => supabase.auth.signOut()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 transition-all duration-150 active:scale-95" title="Sair">
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
              onClick={() => setActiveTab(id)}
              className={cn(
                'relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:scale-95',
                activeTab === id
                  ? 'bg-card text-primary shadow-elevated scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {badge > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          {activeTab === 'orcamentos' && <TabOrcamentos data={orcamentos} loading={isLoading} toast={toast} />}
          {activeTab === 'analises' && <TabAnalises data={orcamentos} isLoading={isLoading} error={isError} />}
          {activeTab === 'agente-ia' && <TabAgenteIA />}
          {activeTab === 'calculo-custo' && <TabCalculoCusto data={orcamentos} isLoading={isLoading} error={isError} />}
          {activeTab === 'admin' && isAdmin && <PainelAdmin toast={toast} />}
        </div>
      </main>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
