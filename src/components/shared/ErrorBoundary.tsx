import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Algo deu errado</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Um erro inesperado ocorreu. Tente recarregar a página.
          </p>
          {this.state.error && (
            <p className="max-w-sm rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
