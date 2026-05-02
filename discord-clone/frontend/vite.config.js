import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Tünel bağlantısına izin ver
    strictPort: true,   // 5173 doluysa başka porta geçme, hata ver
    port: 5173          // 5173 portuna sabitle
  }
})
