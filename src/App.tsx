import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Session } from '@supabase/supabase-js'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import OrcamentoPublico from '@/pages/OrcamentoPublico'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

function AppRoutes({ session }: { session: Session }) {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    )
  }

  if (!profile?.approved) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-brand">
          <span className="font-display text-2xl font-bold text-white">S</span>
        </div>
        <h2 className="font-display text-xl font-bold">Aguardando aprovação</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sua conta foi criada com sucesso. O administrador precisa aprovar seu acesso antes que você possa entrar.
        </p>
        <p className="text-xs text-muted-foreground">Conta: {session.user.email}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-2 text-sm text-primary underline"
        >
          Sair
        </button>
      </div>
    )
  }

  return <ErrorBoundary><Dashboard /></ErrorBoundary>
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Timeout de segurança: se getSession não resolver em 5s, assume sem sessão
    const timeout = setTimeout(() => setSession(null), 5000)
    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout)
      setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      clearTimeout(timeout)
      setSession(s)
    })
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública — não requer autenticação */}
        <Route path="/orcamento/:id" element={<OrcamentoPublico />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={session ? <AppRoutes session={session} /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
