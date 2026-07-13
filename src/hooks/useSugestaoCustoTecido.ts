import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type ProdutoCusto = {
  id: string
  nome: string
  unidade: string
  largura_padrao_cm: number | null
  custo_unitario: number | null
  estoque_categorias: { tipo: string } | null
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export type SugestaoCusto = { nome: string; custoM2: number }

// Sugere o custo/m² a partir do módulo de Estoque quando o tecido digitado
// bate com um produto cadastrado. Falha em silêncio (sem toast) para quem
// não tem permissão de leitura no estoque — a sugestão simplesmente não aparece.
export function useSugestaoCustoTecido(tecido: string): SugestaoCusto | null {
  const { data } = useQuery({
    queryKey: ['estoque-tecidos-custo-sugestao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_produtos')
        .select('id, nome, unidade, largura_padrao_cm, custo_unitario, estoque_categorias(tipo)')
        .eq('ativo', true)
        .not('custo_unitario', 'is', null)
      if (error) return [] as ProdutoCusto[]
      return (data ?? []) as unknown as ProdutoCusto[]
    },
    staleTime: 5 * 60_000,
    retry: 0,
  })

  return useMemo(() => {
    const q = normalize(tecido ?? '')
    if (!q || q.length < 3 || !data?.length) return null
    for (const p of data) {
      const tipo = p.estoque_categorias?.tipo
      if (tipo && tipo !== 'tecido') continue
      const nome = normalize(p.nome)
      if (!(nome.includes(q) || q.includes(nome))) continue
      let custoM2: number | null = null
      if (p.unidade === 'm2') custoM2 = p.custo_unitario
      else if (p.unidade === 'm' && p.largura_padrao_cm && p.custo_unitario != null) {
        custoM2 = p.custo_unitario / (p.largura_padrao_cm / 100)
      }
      if (custoM2 != null && custoM2 > 0) return { nome: p.nome, custoM2 }
    }
    return null
  }, [data, tecido])
}
