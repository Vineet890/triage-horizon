import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to every interface so editor port-forwarding can reach Vite.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.app.github.dev', '.devtunnels.ms'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
