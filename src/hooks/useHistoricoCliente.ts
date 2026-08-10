/**
 * "Esse cliente já esteve aqui" — enquanto o vendedor digita o nome no
 * Calcular/Simulador, busca orçamentos anteriores do mesmo cliente e devolve
 * um resumo pra exibir embaixo do campo. Debounce interno de 400ms.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface HistoricoCliente {
  total: number
  fechados: number
  ultimoModelo: string | null
  ultimaData: string | null
}

export function useHistoricoCliente(nome: string) {
  const [nomeEstavel, setNomeEstavel] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setNomeEstavel(nome.trim()), 400)
    return () => clearTimeout(t)
  }, [nome])

  return useQuery<HistoricoCliente | null>({
    queryKey: ['historico-cliente', nomeEstavel.toLowerCase()],
    enabled: nomeEstavel.length >= 3,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('modelo, fechado, created_at')
        .ilike('cliente', nomeEstavel)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      if (!data || data.length === 0) return null
      return {
        total: data.length,
        fechados: data.filter(o => o.fechado === true).length,
        ultimoModelo: data[0]?.modelo ?? null,
        ultimaData: data[0]?.created_at ?? null,
      }
    },
  })
}

export function resumoHistorico(h: HistoricoCliente): string {
  const quando = h.ultimaData
    ? new Date(h.ultimaData).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : ''
  const partes = [
    `já tem ${h.total} orçamento${h.total > 1 ? 's' : ''}`,
    h.fechados > 0 ? `${h.fechados} fechado${h.fechados > 1 ? 's' : ''}` : null,
    h.ultimoModelo ? `último: ${h.ultimoModelo}${quando ? ` em ${quando}` : ''}` : null,
  ].filter(Boolean)
  return partes.join(' · ')
}
