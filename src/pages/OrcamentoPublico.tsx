import { useParams } from 'react-router-dom'
import { useOrcamentoPublico } from '@/hooks/useKanban'
import { formatCurrency } from '@/lib/utils'
import { MapPin, User, Package, Ruler, Layers, Wrench, DollarSign, CalendarDays, CheckCircle2, Clock } from 'lucide-react'

function Row({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {Icon && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50">
          <Icon className="h-3.5 w-3.5 text-orange-500" />
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
  const { data: orcamento, isLoading, isError } = useOrcamentoPublico(id)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-400 border-t-transparent" />
      </div>
    )
  }

  if (isError || !orcamento) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 shadow-lg">
          <span className="text-2xl font-bold text-white">S</span>
        </div>
        <h1 className="text-lg font-bold text-gray-800">Orçamento não encontrado</h1>
        <p className="max-w-xs text-sm text-gray-500">
          Este link pode ter sido desativado ou não existe. Entre em contato conosco para solicitar um novo.
        </p>
      </div>
    )
  }

  const receita = (orcamento.valor_venda ?? 0) + (orcamento.instacao ?? 0)
  const createdDate = new Date(orcamento.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 pb-8 pt-6 text-white">
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
            {orcamento.fechado ? (
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
              <p className="text-3xl font-bold text-orange-500">{formatCurrency(receita)}</p>
              {orcamento.valor_venda && orcamento.instacao ? (
                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span>Produto: {formatCurrency(orcamento.valor_venda)}</span>
                  <span className="text-gray-200">|</span>
                  <span>Instalação: {formatCurrency(orcamento.instacao)}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

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
        {(orcamento.valor_venda || orcamento.instacao) && (
          <Section title="Financeiro">
            <Row label="Valor do Produto"   value={orcamento.valor_venda ? formatCurrency(orcamento.valor_venda) : null} icon={DollarSign} />
            <Row label="Valor da Instalação" value={orcamento.instacao ? formatCurrency(orcamento.instacao) : null}     icon={DollarSign} />
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
