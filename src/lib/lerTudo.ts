/**
 * Lê uma tabela inteira em páginas. O PostgREST devolve no máximo 1.000 linhas por
 * resposta e não avisa que cortou: sem paginar, a lista e os números perdem os mais
 * antigos em silêncio (mesmo padrão de useOrcamentos e da TECPAV).
 *
 * `pagina(de, ate)` monta a consulta já com `.range(de, ate)` e uma ordem estável.
 */
export const PAGINA = 1000

export async function lerTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1)
    if (error) throw error
    const lote = data ?? []
    todos.push(...lote)
    if (lote.length < PAGINA) break
  }
  return todos
}
