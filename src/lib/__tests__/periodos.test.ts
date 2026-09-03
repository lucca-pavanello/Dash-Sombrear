import { describe, it, expect } from 'vitest'
import { intervaloAtual, periodoAnterior, variacaoPct, dentroDe } from '../periodos'

// data fixa pra o teste não depender de quando roda: quarta, 10/09/2026, meio-dia
const AGORA = new Date(2026, 8, 10, 12, 0, 0)
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('periodoAnterior', () => {
  it('mês usa o mês civil anterior inteiro, não "30 dias atrás"', () => {
    const p = periodoAnterior('mes', undefined, undefined, AGORA)!
    expect(dia(p.inicio)).toBe('2026-08-01')
    expect(dia(p.fim)).toBe('2026-08-31') // agosto inteiro, não 10/08
  })

  it('ano usa o ano civil anterior inteiro', () => {
    const p = periodoAnterior('ano', undefined, undefined, AGORA)!
    expect(dia(p.inicio)).toBe('2025-01-01')
    expect(dia(p.fim)).toBe('2025-12-31')
  })

  it('semana volta a mesma duração, colada no período atual', () => {
    const atual = intervaloAtual('semana', undefined, undefined, AGORA)!
    const ant = periodoAnterior('semana', undefined, undefined, AGORA)!
    // termina 1ms antes de o atual começar — sem buraco e sem sobreposição
    expect(ant.fim.getTime()).toBe(atual.inicio.getTime() - 1)
    const durAtual = atual.fim.getTime() - atual.inicio.getTime()
    const durAnt = ant.fim.getTime() - ant.inicio.getTime()
    expect(durAnt).toBe(durAtual)
  })

  it('custom respeita as datas escolhidas e espelha a duração', () => {
    const ant = periodoAnterior('custom', '2026-09-08', '2026-09-10', AGORA)!
    expect(dia(ant.fim)).toBe('2026-09-07')
    expect(dia(ant.inicio)).toBe('2026-09-05')
  })

  it('"todos" não tem período anterior — não inventa comparação', () => {
    expect(periodoAnterior('todos', undefined, undefined, AGORA)).toBeNull()
    expect(periodoAnterior('tudo', undefined, undefined, AGORA)).toBeNull()
  })
})

describe('variacaoPct', () => {
  it('calcula a variação normal', () => {
    expect(variacaoPct(12, 10)).toBeCloseTo(20)
    expect(variacaoPct(8, 10)).toBeCloseTo(-20)
  })

  it('sem base de comparação devolve null em vez de número inventado', () => {
    // 0 → 3 não é "+300%", é "apareceu agora"
    expect(variacaoPct(3, 0)).toBeNull()
    expect(variacaoPct(0, 0)).toBeNull()
  })
})

describe('dentroDe', () => {
  const faixa = intervaloAtual('custom', '2026-09-01', '2026-09-30', AGORA)!

  it('aceita data dentro e recusa fora', () => {
    expect(dentroDe('2026-09-15T10:00:00Z', faixa)).toBe(true)
    expect(dentroDe('2026-08-31T10:00:00Z', faixa)).toBe(false)
  })

  it('data ausente ou faixa nula não quebram', () => {
    expect(dentroDe(null, faixa)).toBe(false)
    expect(dentroDe('2026-09-15T10:00:00Z', null)).toBe(false)
  })
})
