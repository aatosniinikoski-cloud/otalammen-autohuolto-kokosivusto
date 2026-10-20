import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project under its repository path, not domain root.
export default defineConfig({
  base: '/otalammen-autohuolto-kokosivusto/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4176, strictPort: true },
  preview: { host: '127.0.0.1', port: 4176, strictPort: true }
})
