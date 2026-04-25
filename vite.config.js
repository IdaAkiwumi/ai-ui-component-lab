import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
   // Replace 'your-repo-name' with your actual GitHub repo name
  base: '/ai-ui-component-lab/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})