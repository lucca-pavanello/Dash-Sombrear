import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAddFornecedor, useUpdateFornecedor } from '@/hooks/useEstoqueFornecedores'
import type { EstoqueFornecedor } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const inputClass = 'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

interface Props {
  open: boolean
  onClose: () => void
  toast: (type: ToastType, message: string) => void
  editando?: EstoqueFornecedor | null
}

const EMPTY_FORM = {
  nome: '',
  cnpj: '',
  telefone: '',
  email: '',
  contato: '',
  prazo_entrega_dias: '',
  observacoes: '',
}

export default function NovoFornecedorForm({ open, onClose, toast, editando }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [ativo, setAtivo] = useState(true)

  const addMutation = useAddFornecedor()
  const updateMutation = useUpdateFornecedor()
  const isPending = addMutation.isPending || updateMutation.isPending
  const isEditing = !!editando

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { prev?.focus() }
  }, [open])

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (editando) {
      setForm({
        nome:               editando.nome,
        cnpj:               editando.cnpj ?? '',
        telefone:           editando.telefone ?? '',
        email:              editando.email ?? '',
        contato:            editando.contato ?? '',
        prazo_entrega_dias: editando.prazo_entrega_dias != null ? String(editando.prazo_entrega_dias) : '',
        observacoes:        editando.observacoes ?? '',
      })
      setAtivo(editando.ativo)
    } else {
      setForm(EMPTY_FORM)
      setAtivo(true)
    }
  }, [open, editando])

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => { const n = { ...e }; delete n[key]; return n })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.nome.trim()) e.nome = 'Informe o nome do fornecedor'
    const prazo = form.prazo_entrega_dias ? parseInt(form.prazo_entrega_dias) : null
    if (form.prazo_entrega_dias && (isNaN(prazo!) || prazo! < 0)) {
      e.prazo_entrega_dias = 'Prazo inválido'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      const payload = {
        nome:               form.nome.trim(),
        cnpj:               form.cnpj.trim() || null,
        telefone:           form.telefone.trim() || null,
        email:              form.email.trim() || null,
        contato:            form.contato.trim() || null,
        prazo_entrega_dias: form.prazo_entrega_dias ? parseInt(form.prazo_entrega_dias) : null,
        observacoes:        form.observacoes.trim() || null,
        ativo,
      }
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editando!.id, ...payload })
        toast('success', `Fornecedor "${payload.nome}" atualizado.`)
      } else {
        await addMutation.mutateAsync(payload)
        toast('success', `Fornecedor "${payload.nome}" cadastrado.`)
      }
      onClose()
    } catch (err) {
      console.error('[NovoFornecedorForm]', err)
      toast('error', 'Erro ao salvar fornecedor.')
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-fornecedor"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 id="modal-title-fornecedor" className="font-display text-base font-semibold">
            {isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex: Tecidos Sombrear Ltda"
              className={cn(inputClass, errors.nome && 'border-destructive')}
            />
            {errors.nome && <p className="mt-1 text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>CNPJ</label>
              <input
                value={form.cnpj}
                onChange={(e) => set('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Prazo de entrega (dias)</label>
              <input
                type="number"
                min="0"
                value={form.prazo_entrega_dias}
                onChange={(e) => set('prazo_entrega_dias', e.target.value)}
                placeholder="7"
                className={cn(inputClass, errors.prazo_entrega_dias && 'border-destructive')}
              />
              {errors.prazo_entrega_dias && (
                <p className="mt-1 text-xs text-destructive">{errors.prazo_entrega_dias}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(11) 99999-0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contato@fornecedor.com"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Nome do Contato</label>
            <input
              value={form.contato}
              onChange={(e) => set('contato', e.target.value)}
              placeholder="Ex: João Silva"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
              rows={3}
              placeholder="Informações adicionais..."
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          {isEditing && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Fornecedor ativo</p>
                <p className="text-xs text-muted-foreground">Desativar remove da listagem principal</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ativo}
                onClick={() => setAtivo((v) => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  ativo ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    ativo ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-4 shrink-0 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-muted active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
          </button>
        </div>
      </div>
    </div>
  )
}
