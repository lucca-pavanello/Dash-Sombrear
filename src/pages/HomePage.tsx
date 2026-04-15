import { useNavigate } from 'react-router-dom'
import { Calculator, Package, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo + título */}
      <div className="text-center mb-12">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-brand-gradient items-center justify-center mb-4 shadow-brand">
          <span className="text-white text-2xl font-bold font-display">S</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Sombrear</h1>
        <p className="text-base text-muted-foreground mt-2">Bem-vindo. O que vamos fazer hoje?</p>
      </div>

      {/* 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {/* Card Orçamento */}
        <button
          onClick={() => navigate('/calcular-orcamento')}
          className="group bg-card border border-border rounded-2xl p-8 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all text-left flex flex-col"
        >
          <div className="flex-1">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
              <Calculator className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Orçamento</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Calcular preços, gerar propostas, gerenciar planilhas de orçamento e custos.
            </p>
          </div>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-primary">
            Acessar
            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card Estoque */}
        <button
          onClick={() => navigate('/estoque')}
          className="group bg-card border border-border rounded-2xl p-8 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all text-left flex flex-col"
        >
          <div className="flex-1">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
              <Package className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Estoque</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Gerenciar produtos, fornecedores, registrar entradas, vendas e analisar performance.
            </p>
          </div>
          <div className="mt-6 inline-flex items-center text-sm font-medium text-primary">
            Acessar
            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      <p className="text-xs text-muted-foreground/50 mt-12">Sombrear — Sistema de Gestão</p>
    </div>
  )
}
