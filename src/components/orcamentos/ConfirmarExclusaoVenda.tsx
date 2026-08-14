/**
 * Confirmação de exclusão de venda — o único caminho para apagar faturamento.
 *
 * É modal de propósito: a exclusão mexe no fechamento do mês e no valor a
 * pagar à parceira, então ela para a tela e obriga a ler o que vai sumir.
 * O texto mostra cliente e valor porque é por aí que a pessoa percebe que
 * clicou na linha errada — o nome sozinho se repete, o valor não.
 *
 * Quem chama já garantiu que é admin (ver TabFechamento); aqui só se confirma.
 */
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

export default function ConfirmarExclusaoVenda({
  cliente, valor, data, excluindo, erro, onConfirmar, onCancelar,
}: {
  cliente: string | null | undefined
  /** o que o cliente realmente pagou */
  valor: number
  data?: string | null
  excluindo?: boolean
  erro?: string | null
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Dialog.Root open onOpenChange={aberto => { if (!aberto && !excluindo) onCancelar() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="excluir-venda-descricao"
          className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="font-display text-base font-semibold">
                Excluir esta venda?
              </Dialog.Title>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ela sai do fechamento, dos totais e do valor a pagar à parceira.
              </p>
            </div>
            <button
              type="button" onClick={onCancelar} disabled={excluindo} title="Cancelar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div id="excluir-venda-descricao" className="rounded-lg border border-destructive/25 bg-destructive/[0.04] px-4 py-3 text-center">
            <p className="font-display text-lg font-bold">{cliente?.trim() || 'Sem nome'}</p>
            <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-destructive">
              {formatCurrency(valor)}
            </p>
            {data && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">fechada em {formatDate(data)}</p>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Guardamos uma cópia na lixeira — se for engano, dá para recuperar.
          </p>

          {erro && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
              {erro}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancelar} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmar} disabled={excluindo}>
              {excluindo
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Excluir venda
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
