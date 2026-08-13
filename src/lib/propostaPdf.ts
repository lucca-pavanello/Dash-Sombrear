/**
 * Proposta de orçamento em PDF — versão caprichada, com a marca.
 * Em teste (beta): botão visível só para admin no EditOrcamentoForm.
 * Aprovada, substitui o PDF básico da página pública (OrcamentoPublico.handlePdf).
 */
import type { Orcamento } from '@/lib/supabase'
import { contatoLoja } from '@/lib/pdfMarca'
import { formatCurrency } from '@/lib/utils'

const LARANJA: [number, number, number] = [232, 112, 26]
const TINTA: [number, number, number] = [24, 28, 36]
const CINZA: [number, number, number] = [110, 116, 128]
const CINZA_CLARO: [number, number, number] = [243, 245, 247]

export async function gerarPropostaPdf(orc: Orcamento) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  const W = 210
  const M = 16

  /* ── Faixa da marca ── */
  doc.setFillColor(...LARANJA)
  doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, 8, 18, 18, 4, 4, 'F')
  doc.setTextColor(...LARANJA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('S', M + 9, 21, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(19)
  doc.text('Sombrear', M + 23, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Cortinas e Persianas sob medida', M + 23, 24.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PROPOSTA DE ORÇAMENTO', W - M, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const data = new Date(orc.created_at).toLocaleDateString('pt-BR')
  const numero = `SB-${String(orc.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
  doc.text(`${numero}  ·  ${data}`, W - M, 21.5, { align: 'right' })

  /* ── Cliente ── */
  let y = 44
  doc.setFillColor(...CINZA_CLARO)
  doc.roundedRect(M, y - 6, W - 2 * M, 20, 3, 3, 'F')
  doc.setTextColor(...CINZA)
  doc.setFontSize(8)
  doc.text('PREPARADA PARA', M + 6, y)
  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(orc.cliente ?? 'Cliente', M + 6, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  const linhaDireita = [orc.telefone, orc.responsavel ? `Atendimento: ${orc.responsavel}` : null]
    .filter(Boolean).join('   ·   ')
  if (linhaDireita) doc.text(linhaDireita, W - M - 6, y + 7, { align: 'right' })

  /* ── Item ── */
  y += 24
  const medidas = orc.largura && orc.altura ? `${orc.largura} × ${orc.altura} m` : '—'
  autoTable(doc, {
    startY: y,
    head: [['Produto', 'Tecido / Artigo', 'Medidas', 'Qtd', 'Acabamento']],
    body: [[
      orc.modelo ?? '—',
      orc.tecido ?? '—',
      medidas,
      String(orc.quantidade ?? 1),
      orc.acabamentos && orc.acabamentos !== 'Sem' ? orc.acabamentos : '—',
    ]],
    theme: 'plain',
    headStyles: { fillColor: LARANJA, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 10, textColor: TINTA, cellPadding: 3.5 },
    styles: { lineColor: [225, 228, 233], lineWidth: 0.2 },
    margin: { left: M, right: M },
  })

  /* ── Valores ── */
  const yTabela = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  y = yTabela + 12
  const venda = Number(orc.valor_venda ?? 0)
  const instalacao = Number(orc.instalacao ?? 0)
  const temValores = venda > 0

  if (temValores) {
    const linhas: [string, string, boolean][] = [
      ['Persianas (em até 4x sem juros)', `${formatCurrency(venda)}   ·   4x de ${formatCurrency(venda / 4)}`, false],
      ['À vista (5% de desconto)', formatCurrency(venda * 0.95), false],
    ]
    if (instalacao > 0) {
      linhas.push(['Instalação', formatCurrency(instalacao), false])
      linhas.push(['Total com instalação (4x)', formatCurrency(venda + instalacao), true])
    } else {
      linhas.push(['Total', formatCurrency(venda), true])
    }
    const altura = 12 + linhas.length * 9
    doc.setFillColor(...CINZA_CLARO)
    doc.roundedRect(M, y - 7, W - 2 * M, altura, 3, 3, 'F')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text('VALORES', M + 6, y - 1)
    let ly = y + 7
    for (const [rotulo, valor, destaque] of linhas) {
      doc.setFont('helvetica', destaque ? 'bold' : 'normal')
      doc.setFontSize(destaque ? 12 : 10)
      doc.setTextColor(...(destaque ? LARANJA : TINTA))
      doc.text(rotulo, M + 6, ly)
      doc.text(valor, W - M - 6, ly, { align: 'right' })
      ly += 9
    }
    y += altura + 6
  }

  /* ── Observações ── */
  if (orc.observacoes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text('OBSERVAÇÕES', M, y)
    doc.setFontSize(9)
    doc.setTextColor(...TINTA)
    const obs = doc.splitTextToSize(orc.observacoes, W - 2 * M)
    doc.text(obs, M, y + 5)
    y += 5 + obs.length * 4.5 + 6
  }

  /* ── Link público ── */
  if (orc.share_enabled) {
    const url = `${window.location.origin}/orcamento/${orc.id}`
    doc.setFontSize(9)
    doc.setTextColor(...LARANJA)
    doc.textWithLink('Ver esta proposta online e aceitar em um clique', M, y + 2, { url })
    y += 8
  }

  /* ── Rodapé: o PDF que o CLIENTE recebe é onde CNPJ e WhatsApp mais importam ── */
  doc.setDrawColor(...LARANJA)
  doc.setLineWidth(0.4)
  doc.line(M, 278, W - M, 278)
  doc.setLineWidth(0.2)
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  doc.text('Valores sujeitos a confirmação de medidas no local.', M, 283.5)
  doc.text(`proposta ${numero}`, W - M, 283.5, { align: 'right' })
  doc.text(contatoLoja(), M, 288.5)

  const nomeArquivo = `proposta-sombrear-${(orc.cliente ?? 'cliente').toLowerCase().replace(/\s+/g, '-')}.pdf`
  doc.save(nomeArquivo)
}
