import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use relative paths so the built app works when mounted at any CNCjs path
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      // socket.io is loaded from CNCjs server at runtime via <script> tag
      external: [],
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Forward socket.io and API requests to CNCjs during development
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
