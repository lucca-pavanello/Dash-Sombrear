import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://nlswyjpjzibuvdsaooyg.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_fzqnvcRh3yww4V_2nATdTg_4V_o_Mi3'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Orcamento = {
  id: string
  created_at: string
  responsavel: string
  cliente?: string | null
  largura?: number | null
  altura?: number | null
  modelo: string
  tecido: string
  quantidade: number
  cor_ferragem_motor?: string | null
  acabamentos?: string | null
  custo_tecido?: number | null
  custo_acabamento?: number | null
  custo_m2?: number | null
  fechado?: boolean | null
  telefone?: string | null
  valor_venda?: number | null
  instacao?: number | null
  margem?: number | null
  observacoes?: string | null
  fonte?: string | null
  status?: string | null
  ambiente?: string | null
  user_id?: string | null
  updated_at?: string | null
  share_enabled?: boolean | null
}

export type CustoInterno = {
  id: string
  created_at: string
  responsavel: string | null
  cliente: string | null
  modelo: string
  tecido: string | null
  largura: number | null
  altura: number | null
  quantidade: number | null
  cor_ferragem_motor: string | null
  acabamentos: string | null
  custo_material: number | null
  custo_m2: number | null
  custo_acabamento: number | null
  custo_instalacao: number | null
  ambiente: string | null
  fonte: string | null
}

// ── Estoque ──────────────────────────────────────────────────

export type EstoqueCategoria = {
  id: string
  created_at: string
  nome: string
  tipo: 'tecido' | 'acessorio' | 'ferragem' | 'outro'
}

export type EstoqueProduto = {
  id: string
  created_at: string
  updated_at: string
  nome: string
  codigo: string | null
  categoria_id: string
  unidade: 'm' | 'm2' | 'un' | 'kg'
  largura_padrao_cm: number | null
  quantidade_atual: number
  quantidade_minima: number
  custo_unitario: number | null
  fornecedor: string | null
  ativo: boolean
  observacoes: string | null
  preco_venda?: number | null
  classificacao_abc?: 'A' | 'B' | 'C' | 'sem_dados' | null
  localizacao_id?: string | null
  // embeds de JOIN
  estoque_categorias?: { nome: string; tipo: string } | null
  localizacao?: { codigo: string; setor: string } | null
}

export type EstoqueLocalizacao = {
  id: string
  created_at: string
  updated_at: string
  codigo: string
  setor: string
  prateleira: string | null
  posicao: string | null
  nivel_acesso: 'balcao' | 'acessivel' | 'medio' | 'fundo' | 'deposito'
  descricao: string | null
  ativo: boolean
  estoque_produtos?: { count: number }[]
}

export type EstoqueSugestaoMover = {
  produto_id: string
  sku: string | null
  nome: string
  classe_abc: 'A' | 'B' | 'C'
  localizacao_id: string
  localizacao_codigo: string
  nivel_atual: string
  nivel_sugerido: string
  acao_sugerida: string
}

export type EstoqueFornecedor = {
  id: string
  created_at: string
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  contato: string | null
  prazo_entrega_dias: number | null
  ativo: boolean
  observacoes: string | null
}

export type EstoqueLote = {
  id: string
  created_at: string
  fornecedor_id: string | null
  nf_numero: string | null
  data_entrada: string
  valor_total: number
  observacoes: string | null
  user_id: string | null
  // embed de JOIN
  estoque_fornecedores?: { nome: string } | null
}

export type EstoqueLoteItem = {
  id: string
  created_at: string
  lote_id: string
  produto_id: string
  quantidade: number
  custo_unitario: number
  // embed de JOIN
  estoque_produtos?: { nome: string; unidade: string } | null
}

export type EstoqueProdutoAlerta = EstoqueProduto & {
  categoria_nome: string
  categoria_tipo: string
}

export type EstoqueMovimentacao = {
  id: string
  created_at: string
  produto_id: string
  tipo: 'entrada' | 'saida' | 'ajuste' | 'perda'
  quantidade: number
  quantidade_anterior: number
  orcamento_id: string | null
  motivo: string | null
  nota_fiscal: string | null
  custo_unitario: number | null
  user_id: string | null
  responsavel: string
  // embed de JOIN
  estoque_produtos?: { nome: string; unidade: string } | null
}

export type EstoqueVenda = {
  id: string
  created_at: string
  data: string
  cliente: string | null
  total: number
  vendedor_id: string | null
  observacao: string | null
}

export type EstoqueVendaItem = {
  id: string
  venda_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  desconto: number
  subtotal: number
  // embed de JOIN
  estoque_produtos?: { nome: string; unidade: string } | null
}
