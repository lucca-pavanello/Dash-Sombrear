import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.')
}

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
  ambiente?: string | null
}
