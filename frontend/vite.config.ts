import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.serveousercontent.com',
      '.ngrok-free.dev',
      '.localhost.run',
    ],
    hmr: {
      clientPort: 443, // for https tunnels
    },
  },
})
