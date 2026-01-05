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
        options: resolve(__dirname, 'options/options.html')
      }
    }
  },
  resolve: {
    dedupe: ['@pluckk/shared']
  }
});
