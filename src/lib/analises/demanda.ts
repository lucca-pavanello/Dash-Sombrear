/**
 * O que pedem × o que fecha.
 *
 * As duas medidas têm unidades diferentes — conversas de um lado, reais do outro — então
 * as duas viram PARTICIPAÇÃO no seu próprio total e dividem uma escala de 0-100%. Um
 * gráfico com dois eixos resolveria "mais fácil" e mentiria: dois eixos deixam quem
 * desenha escolher onde as linhas se cruzam.
 */

import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { acharProduto, SEM_PRODUTO } from '@/lib/produtos'
import type { Intervalo } from '@/lib/periodos'
import { dataVenda, ehVenda, noPeriodo, receita } from './base'

export type LinhaDemanda = {
  id: string
  rotulo: string
  conversas: number
  pctDemanda: number
  receita: number
  pctReceita: number
  identificado: boolean
}

export function demandaVsReceita(
  leadsAnalisados: CrmLead[],
  orcamentos: Orcamento[],
  faixa: Intervalo | null,
): { linhas: LinhaDemanda[]; totalConversas: number; totalReceita: number } {
  const conversas = new Map<string, number>()
  for (const l of leadsAnalisados) {
    const p = acharProduto(l.produto_familia ?? l.modelo_interesse)
    conversas.set(p.id, (conversas.get(p.id) ?? 0) + 1)
  }

  const dinheiro = new Map<string, number>()
  for (const o of orcamentos) {
    if (!ehVenda(o) || !noPeriodo(dataVenda(o), faixa)) continue
    // `acharProduto` lê tanto o slug do CRM quanto o texto livre do orçamento
    // ("PH_Aluminio", "Rolo Motorizado"), então os dois lados falam o mesmo vocabulário
    const p = acharProduto(o.modelo)
    dinheiro.set(p.id, (dinheiro.get(p.id) ?? 0) + receita(o))
  }

  const totalConversas = [...conversas.values()].reduce((a, b) => a + b, 0)
  const totalReceita = [...dinheiro.values()].reduce((a, b) => a + b, 0)

  const ids = new Set([...conversas.keys(), ...dinheiro.keys()])
  const linhas = [...ids]
    .map((id) => {
      const n = conversas.get(id) ?? 0
      const r = dinheiro.get(id) ?? 0
      return {
        id,
        rotulo: id === SEM_PRODUTO.id ? SEM_PRODUTO.rotulo : acharProduto(id).rotulo,
        conversas: n,
        pctDemanda: totalConversas ? (n / totalConversas) * 100 : 0,
        receita: r,
        pctReceita: totalReceita ? (r / totalReceita) * 100 : 0,
        identificado: id !== SEM_PRODUTO.id,
      }
    })
    // não identificado sempre por último: é ausência de dado, não uma família de produto
    .sort((a, b) => Number(b.identificado) - Number(a.identificado) || b.pctDemanda - a.pctDemanda || b.pctReceita - a.pctReceita)

  return { linhas, totalConversas, totalReceita }
}
