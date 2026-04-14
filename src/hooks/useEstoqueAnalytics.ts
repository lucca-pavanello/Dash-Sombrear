import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueMovimentacao, EstoqueProduto } from '@/lib/supabase'

export type TopProduto = {
  produto_id: string
  nome: string
  total_saidas: number
  total_entradas: number
}

export function useTopProdutosMovimentados(limit = 10) {
  return useQuery({
    queryKey: ['estoque-analytics-top', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('top_produtos_movimentados', { p_limit: limit })
      if (error) throw error
      return (data ?? []) as TopProduto[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export type ConsumoMensal = {
  mes: string       // 'Jan/25', 'Fev/25', etc.
  entradas: number
  saidas: number
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function mesKey(date: Date): string {
  return `${MESES_PT[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`
}

function subMonthsDate(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d
}

export type ProdutoAbc = Pick<EstoqueProduto, 'id' | 'nome' | 'unidade' | 'quantidade_atual' | 'classificacao_abc'> & {
  total_saidas_90d: number
}

/** Dispara fn_recalcular_abc no banco e invalida o cache de produtos */
export function useRecalcularAbc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fn_recalcular_abc')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-produtos'] }),
  })
}

/** Retorna produtos classificados (A/B/C) com total de saídas nos últimos 90 dias */
export function useCurvaAbc() {
  return useQuery({
    queryKey: ['estoque-curva-abc'],
    queryFn: async () => {
      // Busca produtos ativos com classificação
      const { data: produtos, error: errP } = await supabase
        .from('estoque_produtos')
        .select('id, nome, unidade, quantidade_atual, classificacao_abc')
        .eq('ativo', true)
        .not('classificacao_abc', 'is', null)
        .order('classificacao_abc')
      if (errP) throw errP

      // Busca totais de saída dos últimos 90 dias
      const { data: saidas, error: errS } = await supabase
        .from('estoque_movimentacoes')
        .select('produto_id, quantidade')
        .in('tipo', ['saida', 'perda'])
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      if (errS) throw errS

      const totaisMap = new Map<string, number>()
      for (const s of saidas ?? []) {
        totaisMap.set(s.produto_id, (totaisMap.get(s.produto_id) ?? 0) + Number(s.quantidade))
      }

      return ((produtos ?? []) as EstoqueProduto[]).map(p => ({
        id: p.id,
        nome: p.nome,
        unidade: p.unidade,
        quantidade_atual: p.quantidade_atual,
        classificacao_abc: p.classificacao_abc,
        total_saidas_90d: totaisMap.get(p.id) ?? 0,
      })) as ProdutoAbc[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

// ── Pareto / Trilha C ─────────────────────────────────────────

export type ParetoItem = {
  produto_id: string
  codigo: string
  nome: string
  classificacao_abc: 'A' | 'B' | 'C' | 'sem_dados' | null
  valor_total: number
  percentual_individual: number
  percentual_acumulado: number
}

export type ParetoData = {
  items: ParetoItem[]
  totalVendas: number   // nº de vendas no período (para empty state)
}

export function useParetoData() {
  return useQuery({
    queryKey: ['estoque-pareto-data'],
    queryFn: async (): Promise<ParetoData> => {
      const date90dAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      // 1. Vendas dos últimos 90 dias
      const { data: vendas, error: errV } = await supabase
        .from('estoque_vendas')
        .select('id')
        .gte('data', date90dAgo)
      if (errV) throw errV

      const vendaIds = (vendas ?? []).map((v: { id: string }) => v.id)
      if (vendaIds.length === 0) return { items: [], totalVendas: 0 }

      // 2. Itens dessas vendas com dados do produto
      const { data: itens, error: errI } = await supabase
        .from('estoque_venda_itens')
        .select('produto_id, subtotal, estoque_produtos(id, nome, codigo, classificacao_abc)')
        .in('venda_id', vendaIds)
      if (errI) throw errI

      // 3. Agrega por produto
      const map = new Map<string, {
        produto_id: string
        codigo: string
        nome: string
        classificacao_abc: 'A' | 'B' | 'C' | 'sem_dados' | null
        valor_total: number
      }>()

      type VendaItem = {
        produto_id: string
        subtotal: number
        estoque_produtos: { id: string; nome: string; codigo: string | null; classificacao_abc: string | null } | null
      }

      for (const item of (itens ?? []) as unknown as VendaItem[]) {
        const prod = item.estoque_produtos
        if (!prod) continue
        const existing = map.get(item.produto_id)
        if (existing) {
          existing.valor_total += Number(item.subtotal)
        } else {
          map.set(item.produto_id, {
            produto_id: item.produto_id,
            codigo: prod.codigo ?? item.produto_id.slice(0, 8),
            nome: prod.nome,
            classificacao_abc: (prod.classificacao_abc as 'A' | 'B' | 'C' | 'sem_dados' | null),
            valor_total: Number(item.subtotal),
          })
        }
      }

      // 4. Ordena desc, pega top 20
      const sorted = Array.from(map.values())
        .sort((a, b) => b.valor_total - a.valor_total)
        .slice(0, 20)

      const totalGeral = sorted.reduce((s, p) => s + p.valor_total, 0)

      // 5. Calcula % individual e acumulado
      let acumulado = 0
      const items: ParetoItem[] = sorted.map((p) => {
        const pct = totalGeral > 0 ? (p.valor_total / totalGeral) * 100 : 0
        acumulado += pct
        return {
          ...p,
          percentual_individual: Math.round(pct * 100) / 100,
          percentual_acumulado: Math.round(acumulado * 100) / 100,
        }
      })

      return { items, totalVendas: vendas?.length ?? 0 }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/** Chama estoque_recalcular_abc (por valor monetário, Pareto 80/15/5) */
export function useRecalcularAbcV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('estoque_recalcular_abc')
      if (error) throw error
      return (data as { total_classificados: number; classe_a: number; classe_b: number; classe_c: number }[])?.[0] ?? null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-curva-abc'] })
      qc.invalidateQueries({ queryKey: ['estoque-pareto-data'] })
    },
  })
}

export function useConsumoMensal(meses = 6) {
  return useQuery({
    queryKey: ['estoque-analytics-mensal', meses],
    queryFn: async () => {
      const now = new Date()
      const desde = subMonthsDate(now, meses - 1)
      desde.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('created_at, quantidade, tipo')
        .gte('created_at', desde.toISOString())
        .order('created_at')
      if (error) throw error

      // Inicializa todos os meses do intervalo com zero
      const map = new Map<string, { entradas: number; saidas: number }>()
      for (let i = meses - 1; i >= 0; i--) {
        map.set(mesKey(subMonthsDate(now, i)), { entradas: 0, saidas: 0 })
      }

      for (const row of (data ?? []) as EstoqueMovimentacao[]) {
        const key = mesKey(new Date(row.created_at))
        const entry = map.get(key)
        if (!entry) continue
        if (row.tipo === 'entrada') entry.entradas += row.quantidade
        else if (row.tipo === 'saida' || row.tipo === 'perda') entry.saidas += row.quantidade
      }

      return Array.from(map.entries()).map(([mes, v]) => ({ mes, ...v })) as ConsumoMensal[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

// ── Fase 4 Trilha A — Giro + Análises ────────────────────────

export type GiroResult = {
  vendas_reais: number
  vendas_unidades: number
  estoque_atual_reais: number
  estoque_atual_unidades: number
  giro_reais: number
  giro_unidades: number
}

export type GiroMensalItem = {
  mes: string
  giro_reais: number
  giro_unidades: number
  vendas_reais: number
}

/** Giro anual: chama estoque_calcular_giro sem parâmetros (defaults últimos 365 dias) */
export function useGiroAnual() {
  return useQuery({
    queryKey: ['estoque-giro-anual'],
    queryFn: async (): Promise<GiroResult | null> => {
      const { data, error } = await supabase.rpc('estoque_calcular_giro')
      if (error) throw error
      const row = (data as GiroResult[] | null)?.[0] ?? null
      return row ? {
        vendas_reais:           Number(row.vendas_reais),
        vendas_unidades:        Number(row.vendas_unidades),
        estoque_atual_reais:    Number(row.estoque_atual_reais),
        estoque_atual_unidades: Number(row.estoque_atual_unidades),
        giro_reais:             Number(row.giro_reais),
        giro_unidades:          Number(row.giro_unidades),
      } : null
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/** Giro mensal: 12 chamadas paralelas a estoque_calcular_giro */
export function useGiroMensal() {
  return useQuery({
    queryKey: ['estoque-giro-mensal'],
    queryFn: async (): Promise<GiroMensalItem[]> => {
      const meses = Array.from({ length: 12 }, (_, i) => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - (11 - i))
        const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
        const fim    = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return {
          label: inicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          inicio,
          fim,
        }
      })

      const results = await Promise.all(
        meses.map(m =>
          supabase.rpc('estoque_calcular_giro', {
            p_data_inicio: m.inicio.toISOString().slice(0, 10),
            p_data_fim:    m.fim.toISOString().slice(0, 10),
          }).then(r => ({
            mes:           m.label,
            giro_reais:    Number((r.data as GiroResult[] | null)?.[0]?.giro_reais    ?? 0),
            giro_unidades: Number((r.data as GiroResult[] | null)?.[0]?.giro_unidades ?? 0),
            vendas_reais:  Number((r.data as GiroResult[] | null)?.[0]?.vendas_reais  ?? 0),
          }))
        )
      )
      return results
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export type TopGiroItem = {
  produto_id: string
  codigo: string
  nome: string
  classificacao_abc: string | null
  valor_vendido_90d: number
  quantidade_atual: number
}

export type PiorGiroItem = {
  produto_id: string
  codigo: string
  nome: string
  classificacao_abc: string | null
  dias_sem_vender: number | null
  quantidade_atual: number
  valor_parado: number
}

/** Top 10 produtos com maior valor vendido nos últimos 90 dias */
export function useTopMelhorGiro(limit = 10) {
  return useQuery({
    queryKey: ['estoque-top-melhor-giro', limit],
    queryFn: async (): Promise<TopGiroItem[]> => {
      const date90dAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: vendas, error: errV } = await supabase
        .from('estoque_vendas').select('id').gte('data', date90dAgo)
      if (errV) throw errV
      const vendaIds = (vendas ?? []).map((v: { id: string }) => v.id)
      if (vendaIds.length === 0) return []

      const { data: itens, error: errI } = await supabase
        .from('estoque_venda_itens')
        .select('produto_id, subtotal, estoque_produtos(id, nome, codigo, classificacao_abc, quantidade_atual)')
        .in('venda_id', vendaIds)
      if (errI) throw errI

      type ItemRow = {
        produto_id: string; subtotal: number
        estoque_produtos: { id: string; nome: string; codigo: string | null; classificacao_abc: string | null; quantidade_atual: number } | null
      }

      const map = new Map<string, TopGiroItem>()
      for (const item of (itens ?? []) as unknown as ItemRow[]) {
        const p = item.estoque_produtos
        if (!p) continue
        const ex = map.get(item.produto_id)
        if (ex) {
          ex.valor_vendido_90d += Number(item.subtotal)
        } else {
          map.set(item.produto_id, {
            produto_id:        item.produto_id,
            codigo:            p.codigo ?? item.produto_id.slice(0, 8),
            nome:              p.nome,
            classificacao_abc: p.classificacao_abc,
            valor_vendido_90d: Number(item.subtotal),
            quantidade_atual:  Number(p.quantidade_atual),
          })
        }
      }

      return Array.from(map.values())
        .sort((a, b) => b.valor_vendido_90d - a.valor_vendido_90d)
        .slice(0, limit)
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

/** Top 10 produtos com maior valor parado (baixo giro nos últimos 90 dias) */
export function useTopPiorGiro(limit = 10) {
  return useQuery({
    queryKey: ['estoque-top-pior-giro', limit],
    queryFn: async (): Promise<PiorGiroItem[]> => {
      const date90dAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]

      // 1. Produtos ativos
      const { data: produtos, error: errP } = await supabase
        .from('estoque_produtos')
        .select('id, codigo, nome, classificacao_abc, quantidade_atual, custo_unitario')
        .eq('ativo', true)
      if (errP) throw errP

      // 2. Vendas últimos 90 dias
      const { data: vendas90, error: errV } = await supabase
        .from('estoque_vendas').select('id').gte('data', date90dAgo)
      if (errV) throw errV
      const vendaIds90 = (vendas90 ?? []).map((v: { id: string }) => v.id)

      // 3. Qtd vendida por produto nos últimos 90 dias
      const qtdMap = new Map<string, number>()
      if (vendaIds90.length > 0) {
        const { data: itens90, error: errI } = await supabase
          .from('estoque_venda_itens')
          .select('produto_id, quantidade')
          .in('venda_id', vendaIds90)
        if (errI) throw errI
        for (const it of (itens90 ?? []) as { produto_id: string; quantidade: number }[]) {
          qtdMap.set(it.produto_id, (qtdMap.get(it.produto_id) ?? 0) + Number(it.quantidade))
        }
      }

      // 4. Última data de venda por produto (all time) para dias_sem_vender
      const { data: ultimasVendas, error: errU } = await supabase
        .from('estoque_venda_itens')
        .select('produto_id, estoque_vendas(data)')
      if (errU) throw errU
      const ultimaDataMap = new Map<string, string>()
      for (const it of (ultimasVendas ?? []) as unknown as { produto_id: string; estoque_vendas: { data: string } | null }[]) {
        const d = it.estoque_vendas?.data
        if (!d) continue
        const prev = ultimaDataMap.get(it.produto_id)
        if (!prev || d > prev) ultimaDataMap.set(it.produto_id, d)
      }

      // 5. Filtra e calcula
      const result: PiorGiroItem[] = []
      for (const p of (produtos ?? []) as { id: string; codigo: string | null; nome: string; classificacao_abc: string | null; quantidade_atual: number; custo_unitario: number | null }[]) {
        const qtdVendida = qtdMap.get(p.id) ?? 0
        const qtdAtual   = Number(p.quantidade_atual)
        const threshold  = qtdAtual * 0.05
        if (qtdVendida >= threshold && qtdAtual > 0) continue  // bom giro, pula

        const valorParado = qtdAtual * Number(p.custo_unitario ?? 0)
        const ultimaData  = ultimaDataMap.get(p.id)
        const diasSemVender = ultimaData
          ? Math.floor((new Date(today).getTime() - new Date(ultimaData).getTime()) / (1000 * 60 * 60 * 24))
          : null

        result.push({
          produto_id:        p.id,
          codigo:            p.codigo ?? p.id.slice(0, 8),
          nome:              p.nome,
          classificacao_abc: p.classificacao_abc,
          dias_sem_vender:   diasSemVender,
          quantidade_atual:  qtdAtual,
          valor_parado:      valorParado,
        })
      }

      return result
        .sort((a, b) => b.valor_parado - a.valor_parado)
        .slice(0, limit)
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
