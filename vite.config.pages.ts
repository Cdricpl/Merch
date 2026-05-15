import { defineConfig } from 'vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  base: '/Merch/',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: 'dist-pages',
    rollupOptions: {
      input: resolve(__dirname, 'index.spa.html'),
    },
  },
});
