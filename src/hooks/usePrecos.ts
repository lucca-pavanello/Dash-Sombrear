import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/* ─── Tipos das tabelas precos_* ─────────────────────────── */
// Moraram aqui até 26/09. Saíram para `src/lib/precos/tipos.ts` porque o motor
// de orçamento precisa deles dentro da Edge Function, onde React Query e o
// alias `@/` não existem — era isso que obrigava a manter uma cópia manual do
// motor. A reexportação abaixo mantém todo `import { PrecoX } from '@/hooks/usePrecos'`
// funcionando, então nenhum arquivo do dash precisou mudar.
import type {
  PrecoTecido, PrecoArtigo, PrecoPh50, PrecoFerragemFamilia, PrecoFerragemComponente,
  PrecoFerragemEscada, PrecoBando, PrecoBandoParams, PrecoColocacao, PrecoMotorEstrutura,
  PrecoMotorComponente, PrecoRomanaMatriz, PrecoParametro, PrecoPromocao, PrecoBarraFaixa,
  PrecoTecidoModelo, PrecoTecidoVigente, PrecoCortinaTecido, PrecoCortinaValor,
} from '@/lib/precos/tipos'
export type * from '@/lib/precos/tipos'

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
export const usePrecosTecidosVigentes = () => usePrecosTable<PrecoTecidoVigente>('precos_tecidos_vigentes', ['nome', 'largura'])
export const usePrecosRomanaMatriz = () => usePrecosTable<PrecoRomanaMatriz>('precos_romana_matriz', ['altura', 'largura'])
export const usePrecosCortinaTecidos = () => usePrecosTable<PrecoCortinaTecido>('precos_cortina_tecidos', ['tipo', 'nome'])
export const usePrecosCortinaValores = () => usePrecosTable<PrecoCortinaValor>('precos_cortina_valores', ['chave'])

/* ─── Mutações ───────────────────────────────────────────── */
export function usePrecosMutations() {
  const queryClient = useQueryClient()
  const invalidate = (table: string) => queryClient.invalidateQueries({ queryKey: ['precos', table] })

  // auditoria das edições manuais — habilita o histórico e o Desfazer; falha não bloqueia a edição
  async function auditar(acao: string, detalhe: Record<string, unknown>) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('precos_auditoria').insert({
        usuario: user?.email ?? 'admin', origem: 'grade', acao, detalhe,
      })
      queryClient.invalidateQueries({ queryKey: ['precos', 'auditoria'] })
    } catch { /* histórico é rede de segurança, não trava o fluxo */ }
  }

  async function updateRow(
    table: string, match: Record<string, unknown>, patch: Record<string, unknown>,
    antes?: Record<string, unknown>,
  ) {
    let q = supabase.from(table).update(patch)
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
    const { error } = await q
    if (error) throw error
    invalidate(table)
    if (antes) void auditar('editar_grade', { tabela: table, match, antes, depois: patch })
  }
  async function insertRow(table: string, row: Record<string, unknown>) {
    const { error } = await supabase.from(table).insert(row)
    if (error) throw error
    invalidate(table)
  }
  async function deleteRow(table: string, match: Record<string, unknown>, antes?: Record<string, unknown>) {
    let q = supabase.from(table).delete()
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
    const { error } = await q
    if (error) throw error
    invalidate(table)
    if (antes) void auditar('excluir_grade', { tabela: table, match, antes })
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
