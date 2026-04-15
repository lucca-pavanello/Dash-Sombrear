import { useNavigate } from 'react-router-dom'
import { Calculator, Package, ArrowRight, ShieldCheck } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { ADMIN_EMAIL, ESTOQUE_EMAIL } from '@/lib/constants'

export default function HomePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()

  const isAdmin     = profile?.email === ADMIN_EMAIL || profile?.is_admin === true
  const canOrcamento = isAdmin || profile?.pode_orcamento === true
  const canEstoque   = isAdmin || profile?.pode_estoque === true || profile?.email === ESTOQUE_EMAIL

  const noAccess = !isLoading && profile && !canOrcamento && !canEstoque && !isAdmin

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo + título */}
      <div className="text-center mb-16">
        <div className="inline-flex h-24 w-24 rounded-3xl bg-brand-gradient items-center justify-center mb-6 shadow-brand">
          <span className="text-white text-5xl font-bold font-display tracking-tight">S</span>
        </div>
        <h1 className="font-display text-4xl font-bold text-foreground tracking-tight">Sombrear</h1>
        <p className="text-base text-muted-foreground mt-3">Bem-vindo. O que vamos fazer hoje?</p>
      </div>

      {noAccess ? (
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Acesso pendente</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua conta ainda não possui permissões configuradas. Fale com o administrador do sistema.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl w-full">
          {canOrcamento && (
            <button
              onClick={() => navigate('/calcular-orcamento')}
              className="group bg-card border border-border rounded-3xl p-12 shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 transition-all flex flex-col items-center text-center"
            >
              <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-105 transition-all">
                <Calculator className="h-10 w-10 text-primary group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Orçamento</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
                Calcular preços, gerar propostas, gerenciar planilhas de orçamento e custos.
              </p>
              <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
                Acessar
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}

          {canEstoque && (
            <button
              onClick={() => navigate('/estoque')}
              className="group bg-card border border-border rounded-3xl p-12 shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 transition-all flex flex-col items-center text-center"
            >
              <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-105 transition-all">
                <Package className="h-10 w-10 text-primary group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Estoque</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
                Gerenciar produtos, fornecedores, registrar entradas, vendas e analisar performance.
              </p>
              <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
                Acessar
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="group bg-card border border-border rounded-3xl p-12 shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 transition-all flex flex-col items-center text-center"
            >
              <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-105 transition-all">
                <ShieldCheck className="h-10 w-10 text-primary group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Admin</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
                Gerenciar usuários, aprovar acessos e configurar permissões do sistema.
              </p>
              <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
                Acessar
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 mt-12">Sombrear — Sistema de Gestão</p>
    </div>
  )
}
