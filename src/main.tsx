import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// Dedupe: várias queries podem falhar juntas (mesma queda de rede) — 1 toast basta
let lastQueryErrorAt = 0

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.error('[query]', error)
      const now = Date.now()
      if (now - lastQueryErrorAt < 5000) return
      lastQueryErrorAt = now
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'error', message: 'Falha ao carregar dados. Verifique sua conexão.' },
      }))
    },
  }),
  /* Escrita que falha não pode morrer calada. Antes daqui, uma mutation sem onError
     próprio sumia sem deixar rastro na tela — e quem estava fechando venda lançava
     tudo de novo achando que não tinha salvado. Sem dedupe: escrita é uma por vez. */
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('[mutation]', error)
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          type: 'error',
          message: error instanceof Error && error.message
            ? `Não deu para salvar: ${error.message}`
            : 'Não deu para salvar. Confira a conexão e tente de novo.',
        },
      }))
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
