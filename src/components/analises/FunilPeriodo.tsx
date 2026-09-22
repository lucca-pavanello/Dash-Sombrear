/**
 * O caminho até a venda.
 *
 * As etapas vêm de bases diferentes e a tela diz isso: conversa e orçamento cotado saem
 * do CRM da Amanda, venda sai do Semanário. Sem esse aviso, a última etapa maior que a
 * do meio pareceria erro de conta — quando na verdade é venda de balcão, que entrou sem
 * passar pelo WhatsApp.
 */
import { GitBranch } from 'lucide-react'
import type { Funil } from '@/lib/analises'
import { formatCurrency } from '@/lib/utils'
import { SecaoAnalise, BarraProporcao, NumeroAnimado } from './base'

export default function FunilPeriodo({ funil }: { funil: Funil }) {
  const vazio = funil.etapas.every((e) => e.valor === 0)

  return (
    <SecaoAnalise
      icone={GitBranch}
      titulo="O caminho até a venda"
      pergunta="Onde o funil vaza?"
    >
      {vazio ? (
        <p className="py-6 text-center text-sm text-foreground/50">
          Nenhuma conversa e nenhum pedido neste período. As conversas vêm do WhatsApp da
          Amanda; os pedidos, do Semanário.
        </p>
      ) : (
        <>
          <ol className="space-y-4">
            {funil.etapas.map((e) => (
              <li key={e.id}>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">
                    <NumeroAnimado valor={e.valor} />
                  </span>
                  <span className="text-sm font-semibold text-foreground/80">{e.rotulo}</span>
                  {e.passagem !== null && (
                    <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {e.passagem.toFixed(0)}% da etapa anterior
                    </span>
                  )}
                </div>
                <BarraProporcao fatia={e.fatia} className="mt-1.5 h-4" />
                <p className="mt-1 text-[11px] text-foreground/50">{e.nota}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span>
              Receita fechada:{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(funil.receitaFechada)}
              </span>
            </span>
            {funil.vendasComTelefone > 0 && (
              <span>
                {funil.vendasCasadas} de {funil.vendasComTelefone} vendas com telefone casam com uma
                conversa — o resto entrou sem passar pela Amanda.
              </span>
            )}
          </div>
        </>
      )}
    </SecaoAnalise>
  )
}
