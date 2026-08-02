import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Calculator, CircleDollarSign, Package, ShieldCheck } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { ADMIN_EMAIL, ESTOQUE_EMAIL } from '@/lib/constants'

const CARD_CLS = 'group bg-card border border-border rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 transition-all flex flex-col items-center text-center'
const ICON_WRAP_CLS = 'h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6 group-hover:bg-primary group-hover:scale-105 transition-all'
const ICON_CLS = 'h-7 w-7 md:h-10 md:w-10 text-primary group-hover:text-white transition-colors'

function AreaCard({ titulo, descricao, icon: Icon, onClick }: {
  titulo: string; descricao: string; icon: typeof Calculator; onClick: () => void
}) {
  return (
    <button onClick={onClick} className={CARD_CLS}>
      <div className={ICON_WRAP_CLS}>
        <Icon className={ICON_CLS} />
      </div>
      <h2 className="text-lg md:text-2xl font-bold text-foreground mb-2 md:mb-3">{titulo}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 md:mb-8 max-w-xs mx-auto">{descricao}</p>
      <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
        Acessar
        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()

  useEffect(() => { document.title = 'Sombrear - Início' }, [])

  const isAdmin     = profile?.email === ADMIN_EMAIL || profile?.is_admin === true
  const canOrcamento = isAdmin || profile?.pode_orcamento === true
  const canEstoque   = isAdmin || profile?.pode_estoque === true || profile?.email === ESTOQUE_EMAIL

  const noAccess = !isLoading && profile && !canOrcamento && !canEstoque && !isAdmin

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo + título */}
      <div className="text-center mb-8 md:mb-16">
        <div className="inline-flex h-16 w-16 md:h-24 md:w-24 rounded-2xl md:rounded-3xl bg-brand-gradient items-center justify-center mb-4 md:mb-6 shadow-brand">
          <span className="text-white text-3xl md:text-5xl font-bold font-display tracking-tight">S</span>
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground tracking-tight">Sombrear</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2 md:mt-3">Bem-vindo. O que vamos fazer hoje?</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl w-full">
          {canOrcamento && (
            <AreaCard titulo="Orçamento" icon={Calculator}
              descricao="Calcular preços, gerar propostas, gerenciar planilhas de orçamento e custos."
              onClick={() => navigate('/orcamentos/calcular-orcamento')} />
          )}
          {canEstoque && (
            <AreaCard titulo="Estoque" icon={Package}
              descricao="Gerenciar produtos, fornecedores, registrar entradas, vendas e analisar performance."
              onClick={() => navigate('/estoque')} />
          )}
          {canOrcamento && (
            <AreaCard titulo="Agente IA" icon={Bot}
              descricao="Acompanhar os leads do WhatsApp, conversas e orçamentos gerados pela IA."
              onClick={() => navigate('/agente-ia')} />
          )}
          {isAdmin && (
            <AreaCard titulo="Tabela de Preços" icon={CircleDollarSign}
              descricao="Preços, promoções, simulador e o assistente — a fonte central dos orçamentos."
              onClick={() => navigate('/precos')} />
          )}
          {isAdmin && (
            <AreaCard titulo="Admin" icon={ShieldCheck}
              descricao="Gerenciar usuários, aprovar acessos e configurar permissões do sistema."
              onClick={() => navigate('/admin')} />
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 mt-12">Sombrear — Sistema de Gestão</p>
    </div>
  )
}
