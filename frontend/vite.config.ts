import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }) as ReturnType<typeof react>,
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@design-system': path.resolve(__dirname, './design-system'),
    },
  },
  server: {
    port: 8100,
    proxy: {
      '/api': 'http://localhost:8101',
      '/ws': {
        target: 'ws://localhost:8101',
        ws: true,
      },
    },
  },
});
