import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages workflow sets VITE_BASE_PATH=/${repository.name}/.
// Vercel sets VERCEL=1 — always use site root there so assets resolve correctly.
const base = process.env.VERCEL === '1'
  ? '/'
  : (process.env.VITE_BASE_PATH || '/')

export default defineConfig({
  plugins: [react()],
  base: base
})
