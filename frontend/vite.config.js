import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replace(/\\/g, '/')
          if (!path.includes('node_modules')) return undefined
          if (path.includes('/lucide-react/')) return 'vendor-icons'
          if (path.includes('/quill/') || path.includes('/react-quill/')) return 'vendor-editor'
          if (path.includes('/recharts/') || path.includes('/d3-')) return 'vendor-charts'
          if (path.includes('/date-fns/') || path.includes('/react-datepicker/')) return 'vendor-date'
          if (path.includes('/@tanstack/')) return 'vendor-query'
          if (path.includes('/react-dom/') || path.includes('/react-router-dom/') || path.includes('/react-router/') || path.includes('/react/') || path.includes('/scheduler/')) return 'vendor-react'
          if (path.includes('/react-hot-toast/') || path.includes('/zustand/')) return 'vendor-state'
          return undefined
        },
      },
    },
  },
})
