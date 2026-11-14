import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Preview uses a dynamic HTTPS origin; browser-to-Vite is same-origin,
            // so present the trusted local frontend origin to the internal API.
            proxyReq.setHeader('origin', 'http://localhost:3000');
          });
        },
      },
    },
  },
});
