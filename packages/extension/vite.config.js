import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    crx({ manifest })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel/sidepanel.html'),
        options: resolve(__dirname, 'options/options.html'),
        content: resolve(__dirname, 'src/content.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep content.js at a predictable path for programmatic injection
          if (chunkInfo.name === 'content') {
            return 'content.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  },
  resolve: {
    dedupe: ['@pluckk/shared']
  }
});
