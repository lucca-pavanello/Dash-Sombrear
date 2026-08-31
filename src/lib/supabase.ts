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
  valor_parceiro?: number | null
  valor_cobrado?: number | null
  /** canal que trouxe o cliente — herdado do lead ou marcado na mão no Semanário */
  origem?: string | null
  forma_pagamento?: string | null
  /** como pagou de verdade, em texto livre — a de cima é a condição que definiu o preço */
  forma_pagamento_real?: string | null
  valor_parceiro_pago?: number | null
  custos_detalhe?: { parte: string; tabela: number; fator: number; real: number }[] | null
  /** data do pedido informada na mão (Semanário) — nula usa created_at */
  data_pedido?: string | null
  /** previsão/data de entrega combinada com o cliente (Semanário) */
  data_entrega?: string | null
  /** número do pedido da loja (ex.: "337") */
  numero_pedido?: string | null
  /** vínculo com `pedidos` — agrupa itens do mesmo pedido (metadados, não dinheiro) */
  pedido_id?: string | null
  custo_m2?: number | null
  fechado?: boolean | null
  telefone?: string | null
  valor_venda?: number | null
  instalacao?: number | null
  margem?: number | null
  observacoes?: string | null
  fonte?: string | null
  status?: string | null
  ambiente?: string | null
  user_id?: string | null
  updated_at?: string | null
  share_enabled?: boolean | null
  aceito_em?: string | null
  /** o que aconteceu depois do orçamento: fechou | perdido | sumiu (null = aguardando) */
  desfecho?: string | null
  desfecho_em?: string | null
  desfecho_por?: string | null
  desfecho_motivo?: string | null
}

/**
 * Metadados canônicos de um pedido real da loja — não guarda dinheiro (isso
 * continua por item, em `Orcamento`). Só evita redigitar numero_pedido/
 * data_pedido/origem/forma de pagamento em cada item do mesmo pedido.
 */
export type Pedido = {
  id: string
  created_at: string
  numero_pedido?: string | null
  data_pedido?: string | null
  origem?: string | null
  forma_pagamento?: string | null
  forma_pagamento_real?: string | null
  observacoes?: string | null
  user_id?: string | null
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

export type FornecedorCategoria = {
  id: string
  fornecedor_id: string
  tipo_produto: 'Tecido' | 'Ferragem' | 'Acessorio'
  lead_time_dias: number
  prazo_pagamento_dias?: number | null
  observacao?: string | null
  ativo: boolean
  created_at: string
}

export type FornecedorDescontoCombo = {
  id: string
  fornecedor_id: string
  categorias_combo: string[]
  percentual_desconto: number
  valor_minimo_pedido?: number | null
  observacao?: string | null
  ativo: boolean
  created_at: string
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

export type SugestaoCompra = {
  id: string
  codigo: string | null
  nome: string
  classificacao_abc: string
  quantidade_atual: number
  quantidade_minima: number
  custo_unitario: number | null
  fornecedor_id: string | null
  fornecedor_nome: string | null
  prazo_entrega_dias: number | null
  lec_sugerido: number
  custo_estimado: number
  deficit: number
  urgencia: 'critico' | 'abaixo_minimo' | 'atencao' | 'ok'
}

// ── Analytics: Cobertura + Margem (view: estoque_vw_cobertura_margem) ────────

export type CoberturaMargemRow = {
  produto_id: string
  sku: string | null
  nome: string
  estoque_atual: number
  custo_medio: number | null
  preco_venda: number | null
  classe_abc: string | null
  consumo_90d: number
  cobertura_dias: number | null     // null = sem consumo nos 90d
  margem_percentual: number | null  // null = sem preco_venda ou custo
}

// ── Analytics: ROI do Estoque (fn: estoque_fn_roi_estoque) ───────────────────

export type ROIEstoqueResult = {
  lucro_bruto_90d: number
  lucro_bruto_anualizado: number
  valor_estoque_atual: number
  roi_percentual: number
}

// ── Analytics: Capital Travado (fn: estoque_fn_capital_travado) ──────────────

export type CapitalTravadoResult = {
  total_produtos: number
  total_capital_reais: number
  por_classe: Record<string, number> | null
}
