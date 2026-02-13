import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

/**
 * 백엔드 재시작/비가용 시 발생하는 Vite proxy 에러 로그를 필터링하는 플러그인.
 * ECONNABORTED, ECONNRESET, ECONNREFUSED 등은 프론트엔드 재연결로 자동 복구되므로
 * 개발 터미널 노이즈를 줄이기 위해 조용히 무시합니다.
 */
function silenceProxyErrors(): Plugin {
  return {
    name: 'silence-proxy-errors',
    configureServer(server) {
      const proxyNoise = /ECONNABORTED|ECONNRESET|ECONNREFUSED/;
      const origError = server.config.logger.error;
      server.config.logger.error = (msg, options) => {
        if (typeof msg === 'string' && proxyNoise.test(msg)) return;
        origError(msg, options);
      };
    },
  };
}

export default defineConfig({
  plugins: [
    silenceProxyErrors(),
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
      '/api': {
        target: 'http://localhost:8101',
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
      '/ws': {
        target: 'ws://localhost:8101',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
    },
  },
});
