import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  base: '/static/app',
  outDir: '../static/app',
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: asset => asset.names?.some(name => name.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]',
        },
      },
    },
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              entryFileNames: chunk => chunk.name === 'App' ? 'assets/app.js' : 'assets/[name].js',
              chunkFileNames: 'assets/[name].js',
              assetFileNames: asset => asset.names?.some(name => name.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]',
            },
          },
        },
      },
    },
  },
});
