import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cliente: resolve(__dirname, 'cliente.html'),
        contratista: resolve(__dirname, 'contratista.html'),
        miasistente: resolve(__dirname, 'mi-asistente.html'),
        nicolas: resolve(__dirname, 'nicolas.html'),
        finanzas: resolve(__dirname, 'finanzas.html'),
      },
    },
  },
})
