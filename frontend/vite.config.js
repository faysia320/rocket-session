import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8100,
    proxy: {
      '/api': 'http://localhost:8101',
      '/ws': {
        target: 'ws://localhost:8101',
        ws: true,
      },
    },
  },
})
