import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useOrcamentoPublico } from '@/hooks/useKanban'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { MapPin, User, Package, Ruler, Layers, Wrench, DollarSign, CalendarDays, CheckCircle2, Clock, MessageCircle, FileDown } from 'lucide-react'

// Página pública standalone (sempre clara) — cores fixas no laranja oficial #E8701A
const BRAND = '#E8701A'
const WHATSAPP_LOJA = (import.meta.env.VITE_WHATSAPP_LOJA as string | undefined)?.replace(/\D/g, '')

function Row({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {Icon && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8701A]/10">
          <Icon className="h-3.5 w-3.5 text-[#E8701A]" />
        </span>
      )}
      <div className={Icon ? '' : 'pl-10'}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{title}</h2>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export default function OrcamentoPublico() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: orcamento, isLoading, isError } = useOrcamentoPublico(id)
  const [aceitando, setAceitando] = useState(false)
  const [aceiteErro, setAceiteErro] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  async function handleAceitar() {
    if (!id || aceitando) return
    setAceitando(true)
    setAceiteErro(false)
    const { error } = await supabase.rpc('aceitar_orcamento_publico', { p_id: id })
    setAceitando(false)
    if (error) {
      setAceiteErro(true)
      return
    }
    qc.invalidateQueries({ queryKey: ['orcamento-publico', id] })
  }

  async function handlePdf() {
    if (!orcamento || gerandoPdf) return
    setGerandoPdf(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF()
      const orange: [number, number, number] = [232, 112, 26]
      doc.setFillColor(...orange)
      doc.rect(0, 0, 210, 26, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Sombrear — Orçamento', 14, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Gerado em ${new Date(orcamento.created_at).toLocaleDateString('pt-BR')} · Responsável: ${orcamento.responsavel}`,
        14, 19
      )

      const receita = (orcamento.valor_venda ?? 0) + (orcamento.instalacao ?? 0)
      const rows: [string, string][] = ([
        ['Cliente', orcamento.cliente],
        ['Telefone', orcamento.telefone],
        ['Ambiente', orcamento.ambiente],
        ['Modelo', orcamento.modelo],
        ['Tecido', orcamento.tecido],
        ['Medidas', orcamento.largura && orcamento.altura ? `${orcamento.largura} m × ${orcamento.altura} m` : null],
        ['Quantidade', orcamento.quantidade != null ? String(orcamento.quantidade) : null],
        ['Ferragem / Motor', orcamento.cor_ferragem_motor],
        ['Acabamentos', orcamento.acabamentos],
        ['Valor do Produto', orcamento.valor_venda ? formatCurrency(orcamento.valor_venda) : null],
        ['Valor da Instalação', orcamento.instalacao ? formatCurrency(orcamento.instalacao) : null],
        ['Valor Total', receita > 0 ? formatCurrency(receita) : null],
        ['Observações', orcamento.observacoes],
      ] as [string, string | number | null | undefined][])
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => [k, String(v)])

      autoTable(doc, {
        startY: 32,
        body: rows,
        theme: 'striped',
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
        margin: { left: 14, right: 14 },
      })
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('Sombrear — Cortinas e Persianas', 14, 290)
      doc.save(`orcamento-sombrear-${(orcamento.cliente ?? 'cliente').toLowerCase().replace(/\s+/g, '-')}.pdf`)
    } finally {
      setGerandoPdf(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E8701A] border-t-transparent" />
      </div>
    )
  }

  if (isError || !orcamento) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: BRAND }}>
          <span className="text-2xl font-bold text-white">S</span>
        </div>
        <h1 className="text-lg font-bold text-gray-800">Orçamento não encontrado</h1>
        <p className="max-w-xs text-sm text-gray-500">
          Este link pode ter sido desativado ou não existe. Entre em contato conosco para solicitar um novo.
        </p>
      </div>
    )
  }

  const receita = (orcamento.valor_venda ?? 0) + (orcamento.instalacao ?? 0)
  const aceito = !!orcamento.aceito_em
  const createdDate = new Date(orcamento.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="px-4 pb-8 pt-6 text-white" style={{ background: 'linear-gradient(135deg, #E8701A 0%, #C45E14 100%)' }}>
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow">
              <span className="text-base font-bold text-white">S</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Sombrear</p>
              <p className="text-sm font-bold">Orçamento</p>
            </div>
          </div>

          <h1 className="text-xl font-bold leading-tight">
            {orcamento.cliente ?? 'Orçamento'}
          </h1>
          <p className="mt-1 text-sm text-white/80">Responsável: {orcamento.responsavel}</p>

          {/* Status chip */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1">
            {aceito ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /><span className="text-xs font-semibold">Aceito pelo cliente</span></>
            ) : orcamento.fechado ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /><span className="text-xs font-semibold">Fechado</span></>
            ) : (
              <><Clock className="h-3.5 w-3.5" /><span className="text-xs font-semibold">Em andamento</span></>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-md px-4 -mt-4 pb-10">

        {/* Valor em destaque */}
        {receita > 0 && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="p-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Valor Total</p>
              <p className="text-3xl font-bold" style={{ color: BRAND }}>{formatCurrency(receita)}</p>
              {orcamento.valor_venda && orcamento.instalacao ? (
                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span>Produto: {formatCurrency(orcamento.valor_venda)}</span>
                  <span className="text-gray-200">|</span>
                  <span>Instalação: {formatCurrency(orcamento.instalacao)}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* CTA: aceitar / falar / PDF */}
        <div className="mb-4 space-y-2">
          {aceito ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                Orçamento aceito! Entraremos em contato em breve.
              </p>
            </div>
          ) : (
            <button
              onClick={handleAceitar}
              disabled={aceitando}
              className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #E8701A 0%, #C45E14 100%)' }}
            >
              {aceitando ? 'Registrando…' : 'Aceitar orçamento'}
            </button>
          )}
          {aceiteErro && (
            <p className="text-center text-xs text-red-500">
              Não foi possível registrar o aceite. Fale com a gente pelo WhatsApp.
            </p>
          )}
          <div className="flex gap-2">
            {WHATSAPP_LOJA && (
              <a
                href={`https://wa.me/${WHATSAPP_LOJA.startsWith('55') ? WHATSAPP_LOJA : `55${WHATSAPP_LOJA}`}?text=${encodeURIComponent(`Olá! Vi o orçamento${orcamento.cliente ? ` de ${orcamento.cliente}` : ''} e gostaria de falar com um atendente.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com atendente
              </a>
            )}
            <button
              onClick={handlePdf}
              disabled={gerandoPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              <FileDown className="h-4 w-4" />
              {gerandoPdf ? 'Gerando…' : 'Baixar PDF'}
            </button>
          </div>
        </div>

        {/* Cliente */}
        <Section title="Cliente">
          <Row label="Nome"      value={orcamento.cliente}   icon={User} />
          <Row label="Telefone"  value={orcamento.telefone}  icon={MapPin} />
          <Row label="Ambiente"  value={orcamento.ambiente}  icon={MapPin} />
        </Section>

        {/* Produto */}
        <Section title="Produto">
          <Row label="Modelo"    value={orcamento.modelo}    icon={Package} />
          <Row label="Tecido"    value={orcamento.tecido}    icon={Layers} />
          <Row
            label="Medidas"
            value={orcamento.largura && orcamento.altura
              ? `${orcamento.largura} m × ${orcamento.altura} m`
              : null}
            icon={Ruler}
          />
          <Row label="Quantidade" value={orcamento.quantidade} icon={Layers} />
          <Row label="Ferragem / Motor" value={orcamento.cor_ferragem_motor} icon={Wrench} />
          <Row label="Acabamentos"      value={orcamento.acabamentos}        icon={Wrench} />
        </Section>

        {/* Financeiro */}
        {(orcamento.valor_venda || orcamento.instalacao) && (
          <Section title="Financeiro">
            <Row label="Valor do Produto"   value={orcamento.valor_venda ? formatCurrency(orcamento.valor_venda) : null} icon={DollarSign} />
            <Row label="Valor da Instalação" value={orcamento.instalacao ? formatCurrency(orcamento.instalacao) : null}     icon={DollarSign} />
          </Section>
        )}

        {/* Observações */}
        {orcamento.observacoes && (
          <Section title="Observações">
            <div className="py-3">
              <p className="text-sm text-gray-700 whitespace-pre-line">{orcamento.observacoes}</p>
            </div>
          </Section>
        )}

        {/* Rodapé */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Orçamento gerado em {createdDate}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-300">
            Sombrear — Cortinas e Persianas
          </p>
        </div>
      </main>
    </div>
  )
}
