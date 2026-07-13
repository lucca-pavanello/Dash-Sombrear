import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { RESPONSAVEIS } from '@/lib/constants'

// Lista de responsáveis viva: nomes base (equipe histórica + Stella/Sombrear)
// unidos aos perfis aprovados no Admin — cadastrou gente nova, aparece no form.
export function useResponsaveis(): string[] {
  const { data } = useQuery({
    queryKey: ['responsaveis-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('approved', true)
      if (error) throw error
      return (data ?? []).map((p) => p.full_name).filter(Boolean) as string[]
    },
    staleTime: 5 * 60_000,
  })

  return useMemo(() => {
    const extras = (data ?? []).filter((n) => !RESPONSAVEIS.includes(n)).sort()
    return [...RESPONSAVEIS, ...extras]
  }, [data])
}
