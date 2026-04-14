import { useState } from 'react'
import {
  LayoutDashboard, Package, Truck, PackagePlus, ShoppingCart, TrendingDown, BarChart2, ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueProdutos, useEstoqueProdutosAlerta } from '@/hooks/useEstoqueProdutos'
import { useProfile } from '@/hooks/useProfile'
import EstoqueDashboard from '@/components/estoque/dashboard/EstoqueDashboard'
import EstoqueProdutosTable from '@/components/estoque/EstoqueProdutosTable'
import NovoProdutoForm from '@/components/estoque/NovoProdutoForm'
import NovaMovimentacaoForm from '@/components/estoque/NovaMovimentacaoForm'
import FornecedoresTable from '@/components/estoque/FornecedoresTable'
import EntradaRapidaForm from '@/components/estoque/EntradaRapidaForm'
import EntradasHistoricoTable from '@/components/estoque/EntradasHistoricoTable'
import EstoqueMovimentacoesTable from '@/components/estoque/EstoqueMovimentacoesTable'
import AnalisesDashboard from '@/components/estoque/analises/AnalisesDashboard'
import MoverItensView from '@/components/estoque/MoverItensView'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type SubTab = 'dashboard' | 'produtos' | 'fornecedores' | 'entradas' | 'vendas' | 'analises' | 'mover'
type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { id: 'produtos',     label: 'Produtos',     icon: <Package className="h-3.5 w-3.5" /> },
  { id: 'fornecedores', label: 'Fornecedores', icon: <Truck className="h-3.5 w-3.5" /> },
  { id: 'entradas',     label: 'Entradas',     icon: <PackagePlus className="h-3.5 w-3.5" /> },
  { id: 'vendas',       label: 'Vendas',       icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  { id: 'analises',    label: 'Análises',     icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: 'mover',       label: 'Mover Itens',  icon: <ArrowLeftRight className="h-3.5 w-3.5" /> },
]

interface Props {
  toast: (type: ToastType, message: string) => void
  resetKey?: number
}

export default function TabEstoque({ toast }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard')

  // Modal states
  const [novoProdutoOpen, setNovoProdutoOpen] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState<EstoqueProduto | null>(null)
  const [movOpen, setMovOpen] = useState(false)
  const [movTipo, setMovTipo] = useState<TipoMov>('entrada')
  const [movProduto, setMovProduto] = useState<EstoqueProduto | null>(null)
  const [vendaOpen, setVendaOpen] = useState(false)

  // Data
  const { data: produtos = [] } = useEstoqueProdutos()
  const { data: alertas = [] } = useEstoqueProdutosAlerta()
  const { data: profile } = useProfile()

  const responsavel = profile?.full_name ?? profile?.email ?? 'Usuário'
  const userId = profile?.id

  function handleNovoProduto() {
    setEditandoProduto(null)
    setNovoProdutoOpen(true)
  }

  function handleEditarProduto(p: EstoqueProduto) {
    setEditandoProduto(p)
    setNovoProdutoOpen(true)
  }

  function handleMovimentar(p: EstoqueProduto | EstoqueProdutoAlerta, tipo: TipoMov) {
    setMovProduto(p as EstoqueProduto)
    setMovTipo(tipo)
    setMovOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Estoque</h2>
          <p className="text-xs text-muted-foreground">Gestão de materiais, entradas e vendas</p>
        </div>
      </div>

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
            {id === 'dashboard' && alertas.length > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {alertas.length > 9 ? '9+' : alertas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {subTab === 'dashboard' && (
        <EstoqueDashboard
          toast={toast}
          produtos={produtos}
          alertas={alertas}
          onMovimentar={handleMovimentar}
        />
      )}

      {/* ── Produtos ── */}
      {subTab === 'produtos' && (
        <EstoqueProdutosTable
          toast={toast}
          onNovoProduto={handleNovoProduto}
          onEditar={handleEditarProduto}
          onMovimentar={handleMovimentar}
        />
      )}

      {/* ── Fornecedores ── */}
      {subTab === 'fornecedores' && (
        <FornecedoresTable toast={toast} />
      )}

      {/* ── Entradas ── */}
      {subTab === 'entradas' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-base font-semibold">Registro de Entradas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registre toda compra que chega na loja. O estoque e o custo médio são atualizados automaticamente.
            </p>
          </div>
          <EntradaRapidaForm toast={toast} />
          <EntradasHistoricoTable />
        </div>
      )}

      {/* ── Vendas ── */}
      {subTab === 'vendas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Registro de Vendas</p>
              <p className="text-xs text-muted-foreground">Saídas de estoque por orçamento ou venda direta</p>
            </div>
            <button
              onClick={() => setVendaOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Registrar Venda
            </button>
          </div>
          <EstoqueMovimentacoesTable defaultTipo="saida" />
        </div>
      )}

      {/* ── Análises ── */}
      {subTab === 'analises' && <AnalisesDashboard />}

      {/* ── Mover Itens ── */}
      {subTab === 'mover' && <MoverItensView toast={toast} />}

      {/* ── Modais — Produto e Movimentação ── */}
      <NovoProdutoForm
        open={novoProdutoOpen}
        onClose={() => { setNovoProdutoOpen(false); setEditandoProduto(null) }}
        toast={toast}
        editando={editandoProduto}
        responsavel={responsavel}
      />

      <NovaMovimentacaoForm
        open={movOpen}
        onClose={() => { setMovOpen(false); setMovProduto(null) }}
        toast={toast}
        tipoInicial={movTipo}
        produtoInicial={movProduto}
        responsavel={responsavel}
        userId={userId}
      />

      {/* Modal de venda rápida (botão "Registrar Venda") */}
      <NovaMovimentacaoForm
        open={vendaOpen}
        onClose={() => setVendaOpen(false)}
        toast={toast}
        tipoInicial="saida"
        responsavel={responsavel}
        userId={userId}
      />
    </div>
  )
}
