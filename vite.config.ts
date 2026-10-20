import cesium from 'vite-plugin-cesium'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    // Windows reaches this WSL NAT listener through localhost forwarding.
    // Keep it private and deterministic; do not expose the dev server on the LAN.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Keep Vite's same-origin WebSocket inference and authentication. Pinning a
    // separate HMR host/clientPort breaks forwarded ports and HTTPS proxies.
  },
})
