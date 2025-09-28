import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
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