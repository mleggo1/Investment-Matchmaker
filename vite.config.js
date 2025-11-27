import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use environment variable for base path, default to root for Vercel
// GitHub Pages workflow sets VITE_BASE_PATH=/Investment-Matchmaker/
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base: base
})
