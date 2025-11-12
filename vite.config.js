import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// change this to the actual repo name when you make a new project from this template
const repoName = 'Investment-Matchmaker'



export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`,
})
