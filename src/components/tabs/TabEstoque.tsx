import { useState } from 'react'
import {
  LayoutDashboard, Package, Truck, PackagePlus, ShoppingCart, MapPin,
  Settings, BarChart2,
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
import LocalizacoesTable from '@/components/estoque/LocalizacoesTable'
import AnalisesUnificadas from '@/components/estoque/AnalisesUnificadas'
import SugestaoCompraView from '@/components/estoque/sugestao/SugestaoCompraView'
import RegistroVendasView from '@/components/estoque/RegistroVendasView'
import VendaDetalheView from '@/components/estoque/VendaDetalheView'
import LeadTimeView from '@/components/estoque/LeadTimeView'
import PontoPedidoView from '@/components/estoque/PontoPedidoView'
import MoverItensView from '@/components/estoque/MoverItensView'
import ConfiguracaoView from '@/components/estoque/ConfiguracaoView'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SubTab =
  | 'visao-geral'
  | 'analises'
  | 'produtos'
  | 'fornecedores'
  | 'localizacoes'
  | 'entradas'
  | 'vendas'
  | 'configuracao'
  // drill-downs (não aparecem na navbar, acessados via "Ver todos")
  | 'lead-time'
  | 'mover'
  | 'sugestao'
  | 'ponto-pedido'

type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'

// ─── Grupos de navegação ──────────────────────────────────────────────────────

const GROUP_CADASTROS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'produtos',     label: 'Produtos',     icon: <Package className="h-3.5 w-3.5" /> },
  { id: 'fornecedores', label: 'Fornecedores', icon: <Truck className="h-3.5 w-3.5" /> },
  { id: 'localizacoes', label: 'Localizações', icon: <MapPin className="h-3.5 w-3.5" /> },
]

const GROUP_OPERACAO: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'entradas', label: 'Entradas', icon: <PackagePlus className="h-3.5 w-3.5" /> },
  { id: 'vendas',   label: 'Vendas',   icon: <ShoppingCart className="h-3.5 w-3.5" /> },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
  resetKey?: number
}

// ─── Botão de sub-tab ─────────────────────────────────────────────────────────

function TabBtn({
  id, label, icon, active, badge, onClick,
}: {
  id: SubTab
  label: string
  icon: React.ReactNode
  active: boolean
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      key={id}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
      )}
    >
      {icon}
      {label}
      {badge}
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TabEstoque({ toast }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('visao-geral')

  // Modal states
  const [novoProdutoOpen, setNovoProdutoOpen] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState<EstoqueProduto | null>(null)
  const [movOpen, setMovOpen] = useState(false)
  const [movTipo, setMovTipo] = useState<TipoMov>('entrada')
  const [movProduto, setMovProduto] = useState<EstoqueProduto | null>(null)
  const [vendaDetalheId, setVendaDetalheId] = useState<string | null>(null)

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

  const alertaBadge = alertas.length > 0 ? (
    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
      {alertas.length > 9 ? '9+' : alertas.length}
    </span>
  ) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Estoque</h2>
          <p className="text-xs text-muted-foreground">Gestão de materiais, entradas e vendas</p>
        </div>
      </div>

      {/* ── Navegação em grupos ── */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Visão Geral — destaque no início */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          <TabBtn
            id="visao-geral"
            label="Visão Geral"
            icon={<LayoutDashboard className="h-3.5 w-3.5" />}
            active={subTab === 'visao-geral'}
            badge={alertaBadge}
            onClick={() => setSubTab('visao-geral')}
          />
        </div>

        {/* Separador */}
        <div className="w-px h-8 bg-border self-center" />

        {/* Grupo Cadastros */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            Cadastros
          </span>
          <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
            {GROUP_CADASTROS.map(({ id, label, icon }) => (
              <TabBtn
                key={id}
                id={id}
                label={label}
                icon={icon}
                active={subTab === id}
                onClick={() => setSubTab(id)}
              />
            ))}
          </div>
        </div>

        {/* Grupo Operação */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            Operação
          </span>
          <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
            {GROUP_OPERACAO.map(({ id, label, icon }) => (
              <TabBtn
                key={id}
                id={id}
                label={label}
                icon={icon}
                active={subTab === id}
                onClick={() => setSubTab(id)}
              />
            ))}
          </div>
        </div>

        {/* Grupo Análises */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            Análises
          </span>
          <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
            <TabBtn
              id="analises"
              label="Análises"
              icon={<BarChart2 className="h-3.5 w-3.5" />}
              active={subTab === 'analises' || subTab === 'lead-time' || subTab === 'mover' || subTab === 'sugestao' || subTab === 'ponto-pedido'}
              onClick={() => setSubTab('analises')}
            />
          </div>
        </div>

        {/* Separador */}
        <div className="w-px h-8 bg-border self-center" />

        {/* Configurações — isolado no final */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          <TabBtn
            id="configuracao"
            label="Config."
            icon={<Settings className="h-3.5 w-3.5" />}
            active={subTab === 'configuracao'}
            onClick={() => setSubTab('configuracao')}
          />
        </div>
      </div>

      {/* ── Drill-down breadcrumb (para lead-time / mover / sugestao) ── */}
      {(subTab === 'lead-time' || subTab === 'mover' || subTab === 'sugestao' || subTab === 'ponto-pedido') && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            onClick={() => setSubTab('analises')}
            className="hover:text-foreground hover:underline transition-colors"
          >
            Análises
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">
            {subTab === 'lead-time' ? 'O que está parado' :
             subTab === 'mover' ? 'Como reorganizar' :
             subTab === 'ponto-pedido' ? 'Quando comprar' :
             'O que comprar agora'}
          </span>
        </div>
      )}

      {/* ── Conteúdo ── */}

      {subTab === 'visao-geral' && (
        <EstoqueDashboard
          toast={toast}
          produtos={produtos}
          alertas={alertas}
          onMovimentar={handleMovimentar}
          onNavigateToLeadTime={() => setSubTab('lead-time')}
          onNavigateToAnalises={() => setSubTab('analises')}
          onNavigateToSugestao={() => setSubTab('sugestao')}
        />
      )}

      {subTab === 'analises' && (
        <AnalisesUnificadas toast={toast} onDrillDown={setSubTab} />
      )}

      {subTab === 'produtos' && (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Produtos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cadastre tudo que você vende. Cada produto vira uma 'ficha' que o sistema usa pra todos os cálculos.
            </p>
          </div>
          <EstoqueProdutosTable
            toast={toast}
            onNovoProduto={handleNovoProduto}
            onEditar={handleEditarProduto}
            onMovimentar={handleMovimentar}
          />
        </div>
      )}

      {subTab === 'fornecedores' && (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Fornecedores</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quem te vende as matérias-primas. O tempo de entrega de cada um afeta os cálculos de quando comprar.
            </p>
          </div>
          <FornecedoresTable toast={toast} />
        </div>
      )}

      {subTab === 'localizacoes' && (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Localizações</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Os lugares físicos da sua loja. Use isso pra organizar onde cada produto fica.
            </p>
          </div>
          <LocalizacoesTable toast={toast} />
        </div>
      )}

      {subTab === 'entradas' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-base font-semibold">Entradas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toda compra que chega na loja. O estoque sobe automaticamente.
            </p>
          </div>
          <EntradaRapidaForm toast={toast} />
          <EntradasHistoricoTable />
        </div>
      )}

      {subTab === 'vendas' && (
        vendaDetalheId
          ? <VendaDetalheView vendaId={vendaDetalheId} onVoltar={() => setVendaDetalheId(null)} />
          : (
            <div className="space-y-3">
              <div>
                <h3 className="font-display text-base font-semibold">Vendas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Toda venda é registrada aqui. O estoque desce automaticamente respeitando o{' '}
                  <span className="font-medium">PEPS</span> (primeiro a entrar, primeiro a sair).
                </p>
              </div>
              <RegistroVendasView toast={toast} responsavel={responsavel} userId={userId} onVerDetalhe={setVendaDetalheId} />
            </div>
          )
      )}

      {/* Drill-downs de Análises */}
      {subTab === 'lead-time'    && <LeadTimeView toast={toast} />}
      {subTab === 'mover'        && <MoverItensView toast={toast} />}
      {subTab === 'sugestao'     && <SugestaoCompraView toast={toast} />}
      {subTab === 'ponto-pedido' && <PontoPedidoView toast={toast} />}

      {subTab === 'configuracao' && (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-base font-semibold">Configurações</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Parâmetros que afetam os cálculos do sistema. Mude com cuidado.
            </p>
          </div>
          <ConfiguracaoView toast={toast} />
        </div>
      )}

      {/* ── Modais ── */}
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
    </div>
  )
}
