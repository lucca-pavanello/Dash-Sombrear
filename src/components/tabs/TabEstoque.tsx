import { useState, useMemo } from 'react'
import { Package, History, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueProdutos, useEstoqueProdutosAlerta } from '@/hooks/useEstoqueProdutos'
import { useEstoqueMovimentacoes } from '@/hooks/useEstoqueMovimentacoes'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import EstoqueKPIGrid from '@/components/estoque/EstoqueKPIGrid'
import EstoqueAlertasPanel from '@/components/estoque/EstoqueAlertasPanel'
import EstoqueProdutosTable from '@/components/estoque/EstoqueProdutosTable'
import EstoqueMovimentacoesTable from '@/components/estoque/EstoqueMovimentacoesTable'
import EstoqueAnalises from '@/components/estoque/EstoqueAnalises'
import NovoProdutoForm from '@/components/estoque/NovoProdutoForm'
import NovaMovimentacaoForm from '@/components/estoque/NovaMovimentacaoForm'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type SubTab = 'produtos' | 'historico' | 'analises'
type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'produtos',   label: 'Produtos',   icon: <Package className="h-3.5 w-3.5" /> },
  { id: 'historico',  label: 'Histórico',  icon: <History className="h-3.5 w-3.5" /> },
  { id: 'analises',   label: 'Análises',   icon: <BarChart2 className="h-3.5 w-3.5" /> },
]

interface Props {
  toast: (type: ToastType, message: string) => void
  resetKey?: number
}

export default function TabEstoque({ toast, resetKey }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('produtos')
  const [produtoModalOpen, setProdutoModalOpen] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState<EstoqueProduto | null>(null)
  const [movModalOpen, setMovModalOpen] = useState(false)
  const [movTipo, setMovTipo] = useState<TipoMov>('entrada')
  const [movProduto, setMovProduto] = useState<EstoqueProduto | null>(null)

  const { data: produtos = [], isLoading: loadingProdutos } = useEstoqueProdutos()
  const { data: alertas = [] } = useEstoqueProdutosAlerta()

  // Movimentações de hoje (para KPI)
  const hoje = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])
  const { data: movsHojeData } = useEstoqueMovimentacoes({ dateFrom: hoje })
  const movimentacoesHoje = movsHojeData?.rows ?? []

  // Usuário atual (para preencher responsavel)
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('profiles').select('full_name, id').eq('id', user.id).single()
      return data as { full_name: string; id: string } | null
    },
    staleTime: 5 * 60 * 1000,
  })

  const responsavel = profile?.full_name ?? 'Usuário'
  const userId = profile?.id

  function abrirMovimentacao(produto: EstoqueProduto | EstoqueProdutoAlerta, tipo: TipoMov) {
    setMovProduto(produto as EstoqueProduto)
    setMovTipo(tipo)
    setMovModalOpen(true)
  }

  function abrirEditar(produto: EstoqueProduto) {
    setEditandoProduto(produto)
    setProdutoModalOpen(true)
  }

  function abrirNovoProduto() {
    setEditandoProduto(null)
    setProdutoModalOpen(true)
  }

  if (loadingProdutos) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl border bg-card animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Estoque</h2>
          <p className="text-xs text-muted-foreground">
            {produtos.length} produto{produtos.length !== 1 ? 's' : ''} ativos
            {alertas.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {alertas.length} em alerta</span>
            )}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <EstoqueKPIGrid
        produtos={produtos}
        alertas={alertas}
        movimentacoesHoje={movimentacoesHoje}
        resetKey={resetKey}
      />

      {/* Painel de alertas (só na sub-aba produtos) */}
      {subTab === 'produtos' && alertas.length > 0 && (
        <EstoqueAlertasPanel
          alertas={alertas}
          onMovimentar={(p, tipo) => abrirMovimentacao(p, tipo)}
        />
      )}

      {/* Sub-navegação */}
      <div className="flex gap-1 rounded-xl bg-muted/60 p-1 overflow-x-auto scrollbar-none w-fit">
        {SUB_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 whitespace-nowrap',
              subTab === id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {subTab === 'produtos' && (
        <EstoqueProdutosTable
          produtos={produtos}
          alertas={alertas}
          toast={toast}
          onNovoProduto={abrirNovoProduto}
          onEditar={abrirEditar}
          onMovimentar={(p, tipo) => abrirMovimentacao(p, tipo)}
        />
      )}

      {subTab === 'historico' && (
        <EstoqueMovimentacoesTable />
      )}

      {subTab === 'analises' && (
        <EstoqueAnalises resetKey={resetKey} />
      )}

      {/* Modais */}
      <NovoProdutoForm
        open={produtoModalOpen}
        onClose={() => { setProdutoModalOpen(false); setEditandoProduto(null) }}
        toast={toast}
        editando={editandoProduto}
        responsavel={responsavel}
      />

      <NovaMovimentacaoForm
        open={movModalOpen}
        onClose={() => { setMovModalOpen(false); setMovProduto(null) }}
        toast={toast}
        tipoInicial={movTipo}
        produtoInicial={movProduto}
        responsavel={responsavel}
        userId={userId}
      />
    </div>
  )
}
