import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { ondeAVendaFoiParar } from '@/hooks/usePeriodFilter'

/**
 * O caso real: 02/10/2026 à tarde, alguém lançou a venda da Fernanda, abriu o ajuste e
 * preencheu a data do pedido (11/09). A venda pulou para setembro, sumiu da tela de
 * outubro sem aviso, e foi relançada seis vezes. Estes testes travam o aviso que faltava.
 */
const AGORA = new Date(2026, 9, 2, 15, 0, 0) // sexta, 02/10/2026, 15h

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA) })
afterAll(() => { vi.useRealTimers() })

describe('ondeAVendaFoiParar', () => {
  it('avisa quando a data retroativa tira a venda do mês que está na tela', () => {
    const destino = ondeAVendaFoiParar('2026-09-11T12:00:00', 'mes')
    expect(destino).not.toBeNull()
    expect(destino!.de).toBe('2026-09-01')
    expect(destino!.ate).toBe('2026-09-30')
    expect(destino!.mes).toContain('setembro')
  })

  it('cala a boca quando a venda continua visível', () => {
    expect(ondeAVendaFoiParar('2026-10-02T12:00:00', 'mes')).toBeNull()
  })

  it('não avisa em "Tudo", que mostra qualquer data', () => {
    expect(ondeAVendaFoiParar('2026-09-11T12:00:00', 'todos')).toBeNull()
  })

  it('respeita o período escolhido à mão, não só o mês corrente', () => {
    // a tela está em setembro; salvar com data de agosto também faz sumir
    const dentro = ondeAVendaFoiParar('2026-09-11T12:00:00', 'custom', '2026-09-01', '2026-09-30')
    expect(dentro).toBeNull()
    const fora = ondeAVendaFoiParar('2026-08-20T12:00:00', 'custom', '2026-09-01', '2026-09-30')
    expect(fora!.de).toBe('2026-08-01')
    expect(fora!.ate).toBe('2026-08-31')
  })

  it('fecha o mês no último dia certo, inclusive em fevereiro bissexto', () => {
    expect(ondeAVendaFoiParar('2024-02-05T12:00:00', 'mes')!.ate).toBe('2024-02-29')
  })

  it('data vazia ou inválida não vira aviso — quem reclama disso é a validação', () => {
    expect(ondeAVendaFoiParar(null, 'mes')).toBeNull()
    expect(ondeAVendaFoiParar('', 'mes')).toBeNull()
    expect(ondeAVendaFoiParar('data torta', 'mes')).toBeNull()
  })
})
