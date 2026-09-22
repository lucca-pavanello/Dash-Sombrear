/**
 * O PDF da análise — agora seguindo o período escolhido.
 *
 * O export antigo ignorava qualquer recorte e imprimia todos os fechados de sempre, com
 * o mesmo nome de arquivo. Quem exportasse "mês passado" recebia o histórico inteiro e
 * não tinha como perceber. Aqui o período vai no subtítulo e no nome do arquivo.
 */
import { TEMA_TABELA, faixaMarca, rodapeMarca, alinharSecoes, colunasCentro, colunasDireita } from '@/lib/pdfMarca'
import { formatCurrency } from '@/lib/utils'
import type { Funil, ResumoDinheiro, LinhaObjecao, LinhaDemanda, Canais, LinhaModelo } from '@/lib/analises'

export type DadosPdf = {
  rotuloPeriodo: string
  manchete: string
  funil: Funil
  dinheiro: ResumoDinheiro
  objecoes: LinhaObjecao[]
  analisadas: number
  demanda: LinhaDemanda[]
  canais: Canais
  porModelo: LinhaModelo[]
}

export async function exportarPdf(d: DadosPdf): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  let y = faixaMarca(doc, 'Análise comercial', d.rotuloPeriodo)

  doc.setFontSize(10)
  doc.setTextColor(60)
  const linhas = doc.splitTextToSize(d.manchete, 180) as string[]
  doc.text(linhas, 14, y + 2)
  y += 2 + linhas.length * 5 + 4

  const secao = (titulo: string, head: string[][], body: string[][], colunas: Record<number, 'left' | 'center' | 'right'>) => {
    if (body.length === 0) return
    autoTable(doc, {
      startY: y,
      head: [[{ content: titulo, colSpan: head[0].length, styles: { halign: 'left' as const } }], ...head],
      body,
      ...TEMA_TABELA,
      columnStyles: {
        ...colunasCentro(Object.entries(colunas).filter(([, v]) => v === 'center').map(([k]) => Number(k))),
        ...colunasDireita(Object.entries(colunas).filter(([, v]) => v === 'right').map(([k]) => Number(k))),
      },
      didParseCell: alinharSecoes(colunas),
      margin: { left: 14, right: 14, bottom: 20 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  secao(`De onde vêm (canal registrado em ${d.canais.pctCobertura.toFixed(0)}% das conversas)`,
    [['Canal', 'Conversas', 'Pediram orçamento', 'Score', 'Pedidos', 'Receita atribuída']],
    // a régua "sem canal" vai junto: sem ela o número do canal não tem com o que ser comparado
    [...d.canais.linhas, d.canais.semCanal].filter((l) => l.leads > 0 || l.receita > 0).map((l) => [
      l.rotulo, String(l.leads), `${l.taxaOrcamento.toFixed(0)}%`,
      l.scoreMedio !== null ? l.scoreMedio.toFixed(0) : '—',
      String(l.pedidos), formatCurrency(l.receita),
    ]),
    { 1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'right' })

  secao('O caminho até a venda',
    [['Etapa', 'Quantidade', 'Da etapa anterior']],
    d.funil.etapas.map((e) => [e.rotulo, String(e.valor), e.passagem !== null ? `${e.passagem.toFixed(0)}%` : '—']),
    { 1: 'center', 2: 'center' })

  secao('Rentabilidade por modelo',
    [['Modelo', 'Cotações', 'Vendas', 'Receita', 'Margem']],
    d.porModelo.filter((l) => l.vendas > 0).map((l) => [
      l.modelo, String(l.cotacoes), String(l.vendas), formatCurrency(l.receita),
      l.margem !== null ? `${l.margem.toFixed(0)}%` : '—',
    ]),
    { 1: 'center', 2: 'center', 3: 'right', 4: 'center' })

  secao(`O que trava a venda (base: ${d.analisadas} conversas lidas)`,
    [['Objeção', 'Conversas', 'O que fazer']],
    d.objecoes.map((l) => [l.objecao.rotulo, String(l.n), l.objecao.dica]),
    { 1: 'center' })

  secao('O que pedem x o que fecha',
    [['Produto', 'Conversas', '% da procura', 'Receita', '% da receita']],
    d.demanda.filter((l) => l.conversas > 0 || l.receita > 0).map((l) => [
      l.rotulo, String(l.conversas), `${l.pctDemanda.toFixed(0)}%`,
      formatCurrency(l.receita), `${l.pctReceita.toFixed(0)}%`,
    ]),
    { 1: 'center', 2: 'center', 3: 'right', 4: 'center' })

  rodapeMarca(doc)
  const fatia = d.rotuloPeriodo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`analise-sombrear-${fatia || 'periodo'}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
