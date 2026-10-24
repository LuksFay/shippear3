import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// En desarrollo, /api va al backend local (cd server && npm run dev → :3401).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:3401', changeOrigin: false },
    },
  },
})
