import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/* ─── Tipos das tabelas precos_* ─────────────────────────── */
export interface PrecoTecido {
  id: number; nome: string; tipo: 'blackout' | 'tela_solar' | 'decorativo' | 'outro'
  largura: number; preco: number
}
export interface PrecoArtigo { id: number; categoria: 'PV' | 'PH_ALUMINIO'; nome: string; preco: number }
export interface PrecoPh50 {
  id: number; modelo: string; cor: string; preco_cadarco: number
  preco_fita: number | null; bando_ml: number | null; aba_pc: number | null
}
export interface PrecoFerragemFamilia {
  familia: string; cor: string; espessura: number; larg_min: number; larg_max: number; passo: number
}
export interface PrecoFerragemComponente {
  id: number; familia: string; cor: string; espessura: number
  item: string; tipo_custo: 'por_metro' | 'fixo' | 'opcional_ml' | 'opcional_par'; valor: number
}
export interface PrecoFerragemEscada { familia: string; cor: string; espessura: number; largura: number; custo: number }
export interface PrecoBando { id: number; cor: string; largura: number; qtd_cd: number; qtd_par: number | null }
export interface PrecoBandoParams { cor: string; preco_metro: number; par: number; cd1: number; cd2: number }
export interface PrecoColocacao { id: number; ml_min: number; ml_max: number; preco: number }
export interface PrecoMotorEstrutura { id: number; largura: number; alt_faixa: string; valor: number; obs: string | null; grupo: string | null }
export interface PrecoMotorComponente { id: number; item: string; custo: number }
export interface PrecoParametro { chave: string; valor: number; descricao: string | null }
export interface PrecoPromocao {
  id: number; alvo_tipo: 'tecido' | 'artigo' | 'modelo'; alvo_nome: string
  desconto_pct: number; inicio: string; fim: string
}
export interface PrecoBarraFaixa { largura_min: number; qtd_presilhas: number }
export interface PrecoTecidoModelo { tecido_nome: string; modelo: string }

export const MODELOS_PERSIANA = ['Rolo', 'Double', 'Romana', 'PH_Aluminio', 'PV', 'PH_50', 'Rolo Motorizado'] as const

/* ─── Fetch genérico ─────────────────────────────────────── */
function usePrecosTable<T>(table: string, orderBy: string[]) {
  return useQuery<T[]>({
    queryKey: ['precos', table],
    queryFn: async () => {
      let q = supabase.from(table).select('*')
      for (const col of orderBy) q = q.order(col, { ascending: true })
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as T[]
    },
    staleTime: 30_000,
  })
}

export const usePrecosTecidos = () => usePrecosTable<PrecoTecido>('precos_tecidos', ['nome', 'largura'])
export const usePrecosArtigos = () => usePrecosTable<PrecoArtigo>('precos_artigos', ['categoria', 'nome'])
export const usePrecosPh50 = () => usePrecosTable<PrecoPh50>('precos_ph50', ['modelo', 'cor'])
export const usePrecosFerragemFamilias = () => usePrecosTable<PrecoFerragemFamilia>('precos_ferragem_familias', ['familia', 'cor', 'espessura'])
export const usePrecosFerragemComponentes = () => usePrecosTable<PrecoFerragemComponente>('precos_ferragem_componentes', ['familia', 'cor', 'espessura', 'tipo_custo', 'item'])
export const usePrecosFerragemEscada = () => usePrecosTable<PrecoFerragemEscada>('precos_ferragem_escada', ['familia', 'cor', 'espessura', 'largura'])
export const usePrecosBandos = () => usePrecosTable<PrecoBando>('precos_bandos', ['cor', 'largura'])
export const usePrecosBandosParams = () => usePrecosTable<PrecoBandoParams>('precos_bandos_params', ['cor'])
export const usePrecosColocacao = () => usePrecosTable<PrecoColocacao>('precos_colocacao', ['ml_min'])
export const usePrecosMotorEstrutura = () => usePrecosTable<PrecoMotorEstrutura>('precos_motor_estrutura', ['largura'])
export const usePrecosMotorComponentes = () => usePrecosTable<PrecoMotorComponente>('precos_motor_componentes', ['item'])
export const usePrecosParametros = () => usePrecosTable<PrecoParametro>('precos_parametros', ['chave'])
export const usePrecosPromocoes = () => usePrecosTable<PrecoPromocao>('precos_promocoes', ['inicio'])
export const usePrecosBarraFaixas = () => usePrecosTable<PrecoBarraFaixa>('precos_barra_faixas', ['largura_min'])
export const usePrecosTecidoModelos = () => usePrecosTable<PrecoTecidoModelo>('precos_tecido_modelos', ['tecido_nome', 'modelo'])

/* ─── Mutações ───────────────────────────────────────────── */
export function usePrecosMutations() {
  const queryClient = useQueryClient()
  const invalidate = (table: string) => queryClient.invalidateQueries({ queryKey: ['precos', table] })

  async function updateRow(table: string, match: Record<string, unknown>, patch: Record<string, unknown>) {
    let q = supabase.from(table).update(patch)
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
    const { error } = await q
    if (error) throw error
    invalidate(table)
  }
  async function insertRow(table: string, row: Record<string, unknown>) {
    const { error } = await supabase.from(table).insert(row)
    if (error) throw error
    invalidate(table)
  }
  async function deleteRow(table: string, match: Record<string, unknown>) {
    let q = supabase.from(table).delete()
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
    const { error } = await q
    if (error) throw error
    invalidate(table)
  }
  return { updateRow, insertRow, deleteRow }
}

/* ─── Status de promoção ─────────────────────────────────── */
export function statusPromocao(p: PrecoPromocao): 'ativa' | 'agendada' | 'expirada' {
  const hoje = new Date().toISOString().slice(0, 10)
  if (hoje < p.inicio) return 'agendada'
  if (hoje > p.fim) return 'expirada'
  return 'ativa'
}
