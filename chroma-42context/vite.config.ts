import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['chromadb-default-embed']
    }
  },
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    include: ['chromadb'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})