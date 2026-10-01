/**
 * De onde vêm — a seção principal para quem investe em mídia.
 *
 * A medida em destaque é a **taxa de orçamento** (quantos dos que chegaram pediram
 * preço), e não a receita, por um motivo prático: `orcamentos.origem` está vazia, então
 * a venda só encontra o canal quando o telefone casa com uma conversa. A taxa de
 * orçamento não depende desse rastro — os dois lados dela vivem no CRM — e por isso é a
 * única comparação entre canais que se sustenta hoje.
 *
 * A linha "chegou sem canal marcado" fica visível de propósito: é a régua contra a qual
 * o canal é comparado, e some a tentação de ler o número do canal no vácuo.
 *
 * A frase de destaque ("o Google pede orçamento 4× mais") mora no bloco do topo da aba,
 * não aqui: repetir a mesma conclusão duas vezes na mesma rolagem gasta as duas.
 */
import { Compass } from 'lucide-react'
import type { Canais, LinhaCanal } from '@/lib/analises'
import { acharOrigem, GOOGLE_SITE, DivisaoGoogleSite } from '@/components/agente/SeloOrigem'
import { tabela } from '@/components/shared/estilos'
import { formatCurrency, cn } from '@/lib/utils'
import { SecaoAnalise, Cobertura, Medidor } from './base'

function Linha({ l, maiorTaxa, regua, divisao }: {
  l: LinhaCanal; maiorTaxa: number; regua?: boolean
  /** só no Google + Site: quantas conversas de cada um */
  divisao?: { google: number; site: number }
}) {
  const Icone = acharOrigem(l.id).icone
  return (
    <tr className={cn(tabela.tr, regua && 'bg-muted/20')}>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5">
          <Icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn('text-sm font-semibold',
            regua ? 'text-muted-foreground' : 'text-foreground/85')}>
            {l.rotulo}
          </span>
        </span>
        {divisao && <DivisaoGoogleSite {...divisao} className="mt-0.5 block" />}
      </td>
      <td className="px-4 py-3 text-center text-sm tabular-nums text-foreground/80">{l.leads}</td>
      <td className="px-4 py-3">
        <div className="mx-auto flex max-w-[180px] items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted/70">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                regua ? 'bg-muted-foreground/40' : 'bg-primary')}
              style={{ width: `${maiorTaxa > 0 ? (l.taxaOrcamento / maiorTaxa) * 100 : 0}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
            {l.taxaOrcamento.toFixed(0)}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-sm tabular-nums text-foreground/70">
        {l.scoreMedio !== null ? l.scoreMedio.toFixed(0) : '—'}
      </td>
      <td className="px-4 py-3 text-center text-sm tabular-nums">
        {l.receita > 0
          ? <span className="font-semibold text-foreground">{formatCurrency(l.receita)}</span>
          : <span className="text-muted-foreground/40">—</span>}
      </td>
    </tr>
  )
}

export default function CanalHonesto({ canais }: { canais: Canais }) {
  const baixa = canais.pctCobertura < 50
  const todas = [...canais.linhas, canais.semCanal].filter((l) => l.leads > 0 || l.receita > 0)
  const maiorTaxa = Math.max(1, ...todas.map((l) => l.taxaOrcamento))

  return (
    <SecaoAnalise
      icone={Compass}
      titulo="De onde vêm"
      pergunta="Qual canal traz gente que realmente pede orçamento"
      direita={
        <Cobertura tom={baixa ? 'atencao' : 'neutro'}>
          {canais.identificados} de {canais.total} com canal
        </Cobertura>
      }
    >
      {todas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className={tabela.theadRow}>
                <th className={cn(tabela.th, 'text-center')}>Canal</th>
                <th className={cn(tabela.th, 'text-center')}>Conversas</th>
                <th className={cn(tabela.th, 'text-center')}>Pediram orçamento</th>
                <th className={cn(tabela.th, 'text-center')}>Score</th>
                <th className={cn(tabela.th, 'text-center')}>Receita atribuída</th>
              </tr>
            </thead>
            <tbody>
              {canais.linhas.map((l) => (
                <Linha key={l.id} l={l} maiorTaxa={maiorTaxa}
                  divisao={l.id === GOOGLE_SITE.id ? canais.divisaoGoogleSite : undefined} />
              ))}
              {canais.semCanal.leads > 0 && (
                <Linha l={canais.semCanal} maiorTaxa={maiorTaxa} regua />
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold tabular-nums text-foreground">
            {canais.pctCobertura.toFixed(0)}%
          </span>
          <span className="text-xs text-foreground/60">das conversas chegam com o canal registrado</span>
        </div>
        <div className="mt-2">
          <Medidor pct={canais.pctCobertura} tom={baixa ? 'atencao' : 'neutro'} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-foreground/65">
          {canais.vendasAtribuidas} de {canais.vendasComTelefone} pedidos com telefone dá pra ligar a um
          canal ({formatCurrency(canais.receitaAtribuida)} de {formatCurrency(canais.receitaTotal)}).
          {baixa && ' Enquanto a marcação não subir, "quanto o Google faturou" não tem resposta fechada — o que a tabela acima mede bem é a qualidade do lead, não a receita.'}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          O canal é capturado pela Amanda na primeira mensagem e pode ser corrigido na mão ao
          abrir a venda no Semanário.
          {!canais.temCampanha && ' Nenhuma conversa traz campanha identificada ainda, então não dá pra separar anúncio de busca orgânica.'}
        </p>
      </div>
    </SecaoAnalise>
  )
}
