import { useNavigate } from 'react-router-dom'
import { Calculator, Package, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

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

      {/* 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Card Orçamento */}
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

        {/* Card Estoque */}
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
      </div>

      <p className="text-xs text-muted-foreground/50 mt-12">Sombrear — Sistema de Gestão</p>
    </div>
  )
}
