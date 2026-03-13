import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':   ['@tanstack/react-query'],
          'vendor-supabase':['@supabase/supabase-js'],
          'vendor-charts':  ['recharts'],
          'vendor-xlsx':    ['xlsx'],
          'vendor-pdf':     ['jspdf', 'jspdf-autotable'],
          'vendor-canvas':  ['html2canvas'],
        },
      },
    },
  },
})
