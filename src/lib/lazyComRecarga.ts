/**
 * lazy() que sobrevive a um deploy no meio do uso.
 *
 * O app é dividido em pedaços com nome versionado (TabPrecos-Cipw47Eb.js). Ao
 * publicar uma versão nova, os arquivos antigos deixam de existir — quem estava
 * com a página aberta e clica numa aba pede um arquivo que sumiu e vê
 * "Failed to fetch dynamically imported module".
 *
 * Aqui a gente tenta de novo (pode ter sido só a rede) e, se ainda falhar,
 * recarrega a página uma única vez para buscar a lista nova de arquivos. A
 * trava em sessionStorage evita laço infinito se o erro for outro.
 */
import { lazy, type ComponentType } from 'react'

const CHAVE_RECARGA = 'sombrear-recarga-chunk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyComRecarga<T extends ComponentType<any>>(
  carregar: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const modulo = await carregar()
      sessionStorage.removeItem(CHAVE_RECARGA) // carregou: zera a trava
      return modulo
    } catch (erro) {
      try {
        // segunda chance: falha de rede momentânea não precisa de recarga
        const modulo = await carregar()
        sessionStorage.removeItem(CHAVE_RECARGA)
        return modulo
      } catch {
        if (!sessionStorage.getItem(CHAVE_RECARGA)) {
          sessionStorage.setItem(CHAVE_RECARGA, '1')
          window.location.reload()
          // devolve um componente vazio enquanto a página recarrega
          return { default: (() => null) as unknown as T }
        }
        throw erro
      }
    }
  })
}
