import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Handle SPA routing - redirect all routes to index.html
  appType: 'spa',
})
