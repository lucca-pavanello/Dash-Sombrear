/**
 * Calculadora de cortina Wave — o que hoje a loja faz no GPT.
 *
 * A conta roda aqui no navegador com o motor de `@/lib/cortina`, lendo os
 * preços do banco. Mostra o memorial passo a passo porque é isso que a loja
 * confere quando o valor parece alto ou baixo demais, e monta o texto do
 * orçamento no formato que ela já manda pro cliente.
 */
import { useMemo, useState } from 'react'
import { Calculator, Check, ClipboardCopy, Ruler, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { usePrecosCortinaTecidos, usePrecosCortinaValores } from '@/hooks/usePrecos'
import { calcularCortina, type SuporteCortina } from '@/lib/cortina'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

const SUPORTES: { id: SuporteCortina; label: string }[] = [
  { id: 'trilho_simples', label: 'Trilho simples' },
  { id: 'trilho_duplo', label: 'Trilho duplo' },
  { id: 'varao_simples', label: 'Varão simples' },
  { id: 'varao_duplo', label: 'Varão duplo' },
]

const rotulo = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/45'
const campo = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function CalculadoraCortina() {
  const { data: tecidos } = usePrecosCortinaTecidos()
  const { data: valores } = usePrecosCortinaValores()

  const [cliente, setCliente] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [tecido, setTecido] = useState('')
  const [forro, setForro] = useState('Sem forro')
  const [suporte, setSuporte] = useState<SuporteCortina>('trilho_simples')
  const [quantidade, setQuantidade] = useState('1')
  const [colocacao, setColocacao] = useState(false)
  const [franzido, setFranzido] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const opcoesTecido = useMemo(
    () => (tecidos ?? []).filter(t => t.tipo === 'tecido').map(t => t.nome), [tecidos])
  const opcoesForro = useMemo(
    () => ['Sem forro', ...(tecidos ?? []).filter(t => t.tipo === 'forro').map(t => t.nome)], [tecidos])

  const resultado = useMemo(() => {
    if (!tecidos?.length || !valores?.length) return null
    if (!(num(largura) > 0) || !(num(altura) > 0) || !tecido) return null
    return calcularCortina({
      largura: num(largura), altura: num(altura), tecido,
      forro: forro === 'Sem forro' ? null : forro,
      suporte, quantidade: Math.max(1, Math.round(num(quantidade) || 1)),
      incluirColocacao: colocacao, franzido,
    }, { tecidos, valores })
  }, [tecidos, valores, largura, altura, tecido, forro, suporte, quantidade, colocacao, franzido])

  const ok = resultado && !('erro' in resultado) ? resultado : null

  /** Mesmo formato que a loja já manda no WhatsApp */
  const textoOrcamento = () => {
    if (!ok) return ''
    const qtd = ok.quantidade > 1 ? `(0${ok.quantidade}) ` : '(01) '
    const desc = forro === 'Sem forro' ? tecido : `${tecido} com ${forro.toLowerCase()}`
    const sup = SUPORTES.find(s => s.id === suporte)?.label.toLowerCase() ?? ''
    return [
      'ORÇAMENTO – Sombrear Cortinas e Persianas',
      '',
      `Cliente: ${cliente || '—'}`,
      '',
      'Descrição:',
      `${qtd}Cortina modelo Wave em ${desc}, em ${sup}${colocacao ? ', colocada' : ''}.`,
      '',
      `Medida: ${largura.replace('.', ',')} × ${altura.replace('.', ',')}`,
      '',
      brl(ok.parcelado),
      '',
      'Condições de pagamento',
      'Até 4x no cartão.',
      `À vista com 5% de desconto: ${brl(ok.avista)}.`,
      '',
      `Observação: ${colocacao ? 'Colocação inclusa (sob consulta de localidade).' : 'Colocação não inclusa.'}`,
      '',
      'Sombrear Cortinas e Persianas',
      'Avenida Fernando Costa, 984 – Vila Maceno.',
    ].join('\n')
  }

  const copiar = async () => {
    await navigator.clipboard.writeText(textoOrcamento())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* ── entrada ── */}
      <div className="space-y-3 rounded-2xl border-2 bg-card p-4">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Cortina Wave</h3>
        </div>

        <div>
          <label className={rotulo}>Cliente</label>
          <input className={campo} value={cliente} onChange={e => setCliente(e.target.value)}
            placeholder="Nome do cliente" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo}>Largura (m)</label>
            <input className={campo} inputMode="decimal" value={largura}
              onChange={e => setLargura(e.target.value)} placeholder="2,50" />
          </div>
          <div>
            <label className={rotulo}>Altura (m)</label>
            <input className={campo} inputMode="decimal" value={altura}
              onChange={e => setAltura(e.target.value)} placeholder="2,55" />
          </div>
        </div>

        <div>
          <label className={rotulo}>Tecido</label>
          <CustomSelect value={tecido} onChange={setTecido} options={opcoesTecido}
            placeholder="Escolha o tecido" />
        </div>

        <div>
          <label className={rotulo}>Forro / blackout</label>
          <CustomSelect value={forro} onChange={setForro} options={opcoesForro} />
        </div>

        <div>
          <label className={rotulo}>Trilho ou varão</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SUPORTES.map(s => (
              <button key={s.id} type="button" onClick={() => setSuporte(s.id)}
                className={cn('rounded-lg border px-2 py-2 text-xs font-semibold transition-all active:scale-95',
                  suporte === s.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground/60 hover:border-muted-foreground/40 hover:bg-muted/30')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo}>Quantidade</label>
            <input className={campo} inputMode="numeric" value={quantidade}
              onChange={e => setQuantidade(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-end gap-2 pb-2">
            <input type="checkbox" checked={colocacao} onChange={e => setColocacao(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]" />
            <span className="text-xs font-medium">Com colocação</span>
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2">
          <input type="checkbox" checked={franzido} onChange={e => setFranzido(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]" />
          <span className="text-xs font-medium">Wave na frente + franzido atrás</span>
        </label>
      </div>

      {/* ── resultado ── */}
      <div className="space-y-3">
        {resultado && 'erro' in resultado && (
          <div className="flex items-start gap-2.5 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-foreground/80">{resultado.erro}</p>
          </div>
        )}

        {!resultado && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 text-center">
            <Calculator className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Preencha medida e tecido para ver o cálculo.</p>
          </div>
        )}

        {ok && (
          <>
            <div className="rounded-2xl border-2 bg-card p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground/45">
                Como o consumo foi calculado
              </p>
              <ol className="space-y-1">
                {ok.memorial.map((m, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground/75">
                    <span className="font-bold tabular-nums text-primary">{i + 1}.</span>{m}
                  </li>
                ))}
              </ol>
              <p className="mt-2 border-t pt-2 text-sm">
                Consumo: <b className="tabular-nums">{ok.consumo.toFixed(2).replace('.', ',')}m</b>
                {ok.quantidade > 1 && <span className="text-muted-foreground"> por cortina</span>}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-bold">Item</th>
                    <th className="px-3 py-2 text-left font-bold">Conta</th>
                    <th className="px-3 py-2 text-right font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ok.itens.map((i, k) => (
                    <tr key={k}>
                      <td className="px-3 py-1.5 font-medium">{i.item}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{i.conta}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{brl(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/20">
                    <td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Subtotal
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{brl(ok.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 bg-card p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">Até 4x no cartão</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{brl(ok.parcelado)}</p>
              </div>
              <div className="rounded-2xl border-2 border-emerald-500/25 bg-emerald-500/5 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  À vista (−5%)
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {brl(ok.avista)}
                </p>
              </div>
            </div>

            {ok.observacoes.length > 0 && (
              <ul className="space-y-1 rounded-2xl border-2 bg-muted/20 p-3">
                {ok.observacoes.map((o, i) => (
                  <li key={i} className="text-xs text-muted-foreground">· {o}</li>
                ))}
              </ul>
            )}

            <button type="button" onClick={copiar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-brand transition-all hover:opacity-95 active:scale-[0.99]">
              {copiado ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copiado ? 'Copiado!' : 'Copiar orçamento pronto'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
