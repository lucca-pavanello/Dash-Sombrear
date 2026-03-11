import { useQuery } from '@tanstack/react-query'

const SHEET_ID  = import.meta.env.VITE_GOOGLE_SHEETS_ID  as string
const GID       = import.meta.env.VITE_GOOGLE_SHEETS_GID  as string
const API_KEY   = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY as string
const BASE      = 'https://sheets.googleapis.com/v4/spreadsheets'

export interface ModelosTecidos {
  modelos: string[]
  tecidosPorModelo: Record<string, string[]>
}

async function fetchModelosTecidos(): Promise<ModelosTecidos> {
  // 1. busca metadados para descobrir o nome da aba pelo GID
  const metaRes = await fetch(`${BASE}/${SHEET_ID}?key=${API_KEY}`)
  if (!metaRes.ok) throw new Error(`Metadados: HTTP ${metaRes.status}`)
  const meta = await metaRes.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet = (meta.sheets as any[]).find(
    (s) => s.properties.sheetId === parseInt(GID)
  )
  if (!sheet) throw new Error(`Aba com GID ${GID} não encontrada`)

  const sheetTitle: string = sheet.properties.title

  // 2. busca os valores da aba
  const valRes = await fetch(
    `${BASE}/${SHEET_ID}/values/${encodeURIComponent(sheetTitle)}?key=${API_KEY}`
  )
  if (!valRes.ok) throw new Error(`Valores: HTTP ${valRes.status}`)
  const data = await valRes.json()

  const rows: string[][] = (data.values ?? []).map((row: string[]) =>
    row.map((cell) => (cell ?? '').trim())
  )

  if (rows.length === 0) return { modelos: [], tecidosPorModelo: {} }

  const headers = rows[0]
  const dataRows = rows.slice(1)

  const modelos = headers.filter((h) => h.length > 0)

  const tecidosPorModelo: Record<string, string[]> = {}
  headers.forEach((model, colIdx) => {
    if (!model) return
    tecidosPorModelo[model] = dataRows
      .map((row) => row[colIdx] ?? '')
      .filter((cell) => cell.length > 0)
  })

  return { modelos, tecidosPorModelo }
}

export function useModelosTecidos() {
  return useQuery<ModelosTecidos, Error>({
    queryKey: ['modelos-tecidos'],
    queryFn: fetchModelosTecidos,
    staleTime: 5 * 60 * 1000,   // cache 5 minutos
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
