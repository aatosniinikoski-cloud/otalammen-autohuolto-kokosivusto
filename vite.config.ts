import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local-only, independent build. No repository identity or deployment config.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4176, strictPort: true },
  preview: { host: '127.0.0.1', port: 4176, strictPort: true }
})
