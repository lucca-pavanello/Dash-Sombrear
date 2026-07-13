import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
