import { useQuery } from '@tanstack/react-query'

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID as string
const GID      = import.meta.env.VITE_GOOGLE_SHEETS_GID  as string

// gviz/tq é CORS-safe; /export tem problemas de CORS e redireciona para login
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`

export interface ModelosTecidos {
  modelos: string[]
  tecidosPorModelo: Record<string, string[]>
}

/** Parser CSV simples que respeita campos com aspas */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.trim())
    rows.push(cols)
  }
  return rows
}

async function fetchModelosTecidos(): Promise<ModelosTecidos> {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`CSV fetch: HTTP ${res.status}`)
  const text = await res.text()
  // Google retorna HTML (login/erro) quando a planilha não está pública
  if (text.trimStart().startsWith('<')) {
    throw new Error('Planilha não acessível — verifique se está compartilhada publicamente (qualquer pessoa com o link)')
  }

  const rows = parseCSV(text)
  if (rows.length === 0) return { modelos: [], tecidosPorModelo: {} }

  // Linha 0 = nomes dos modelos (cabeçalho)
  const headers = rows[0]
  if (headers.every(h => h === '')) {
    throw new Error('Planilha sem cabeçalhos — verifique se a estrutura da aba está correta (linha 1 = nomes dos modelos)')
  }
  const dataRows = rows.slice(1)

  const modelos = headers.filter((h) => h.length > 0)

  const tecidosPorModelo: Record<string, string[]> = {}
  headers.forEach((model, colIdx) => {
    if (!model) return
    tecidosPorModelo[model] = [...new Set(
      dataRows
        .map((row) => (row[colIdx] ?? '').trim())
        .filter((cell) => cell.length > 0)
    )]
  })

  return { modelos, tecidosPorModelo }
}

export function useModelosTecidos() {
  return useQuery<ModelosTecidos, Error>({
    queryKey: ['modelos-tecidos'],
    queryFn: fetchModelosTecidos,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
