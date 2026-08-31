/**
 * Rateia um valor total entre N linhas, proporcional ao peso de cada uma —
 * pra quando o total combinado com o cliente difere da soma calculada, mas a
 * quebra por item no Semanário/Planilha precisa continuar batendo o total.
 * A última linha absorve a sobra de arredondamento, pra soma sempre bater
 * exatamente com o total pedido (nunca fica 1 centavo de diferença perdido).
 */
export function ratear(total: number, pesos: number[]): number[] {
  const somaPesos = pesos.reduce((s, p) => s + p, 0)
  let acumulado = 0
  return pesos.map((peso, i) => {
    if (i === pesos.length - 1) return Math.round((total - acumulado) * 100) / 100
    const parte = somaPesos > 0
      ? Math.round(total * (peso / somaPesos) * 100) / 100
      : Math.round((total / pesos.length) * 100) / 100
    acumulado += parte
    return parte
  })
}
