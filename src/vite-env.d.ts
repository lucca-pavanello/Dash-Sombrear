/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FEATURE_AI_ESTOQUE: string
  readonly VITE_GOOGLE_SHEETS_API_KEY: string
  readonly VITE_GOOGLE_SHEETS_ID: string
  readonly VITE_GOOGLE_SHEETS_GID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
