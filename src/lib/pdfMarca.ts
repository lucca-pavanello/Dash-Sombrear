/**
 * Identidade Sombrear nos PDFs — a MESMA faixa em todos.
 *
 * Antes cada exportador desenhava seu cabeçalho ("Loja Sombrear",
 * "Sombrear — Orçamentos", "Sombrear — Fechamento de vendas"…) e só a
 * proposta ao cliente tinha a marca de verdade. Este módulo extrai a faixa
 * da proposta — quadrado branco com o S, wordmark, subtítulo — e um rodapé
 * padrão com endereço, data de geração e página, pra tudo sair da mesma
 * família.
 *
 * Cada mudança aqui muda TODOS os PDFs de uma vez — é o ponto.
 */
import type { jsPDF } from 'jspdf'

export const LARANJA: [number, number, number] = [232, 112, 26]
const CINZA_TEXTO: [number, number, number] = [130, 130, 130]

export const ENDERECO = 'Sombrear Cortinas e Persianas · Av. Fernando Costa, 984 – Vila Maceno'

/** Estilos de tabela compartilhados (autoTable) */
export const TEMA_TABELA = {
  theme: 'striped' as const,
  headStyles: { fillColor: LARANJA, textColor: 255 as const, fontStyle: 'bold' as const, fontSize: 9 },
  footStyles: { fillColor: [243, 245, 247] as [number, number, number], textColor: [24, 28, 36] as [number, number, number], fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: [252, 248, 245] as [number, number, number] },
  bodyStyles: { fontSize: 9 },
}

/** halign à direita para as colunas de dinheiro — papel lê número pela vírgula */
export const colunasDireita = (indices: number[]) =>
  Object.fromEntries(indices.map(i => [i, { halign: 'right' as const }]))

export const colunasCentro = (indices: number[]) =>
  Object.fromEntries(indices.map(i => [i, { halign: 'center' as const }]))

/**
 * Faixa da marca no topo da página atual. Retorna o Y onde o conteúdo começa.
 * `titulo` fica à direita em caixa alta (é o assunto do documento; a marca é fixa).
 */
export function faixaMarca(doc: jsPDF, titulo: string, subtitulo?: string): number {
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  doc.setFillColor(...LARANJA)
  doc.rect(0, 0, W, 30, 'F')

  // o "S" no quadrado branco — mesmo desenho do app e da proposta
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, 6.5, 17, 17, 3.5, 3.5, 'F')
  doc.setTextColor(...LARANJA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('S', M + 8.5, 17.5, { align: 'center' })

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.text('Sombrear', M + 21.5, 15.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Cortinas e Persianas sob medida', M + 21.5, 21.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(titulo.toUpperCase(), W - M, subtitulo ? 14 : 17, { align: 'right' })
  if (subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(subtitulo, W - M, 20.5, { align: 'right' })
  }
  doc.setTextColor(40, 40, 40)
  doc.setFont('helvetica', 'normal')
  return 38
}

/** Rodapé em TODAS as páginas: endereço, geração e "pág X de Y". Chamar por último. */
export function rodapeMarca(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()
  const quando = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(230)
    doc.line(14, H - 14, W - 14, H - 14)
    doc.setFontSize(7.5)
    doc.setTextColor(...CINZA_TEXTO)
    doc.text(ENDERECO, 14, H - 9)
    doc.text(`Gerado em ${quando}`, W / 2, H - 9, { align: 'center' })
    doc.text(`pág. ${p} de ${total}`, W - 14, H - 9, { align: 'right' })
  }
}
