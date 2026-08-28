import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { build as esbuild } from 'esbuild';

/**
 * Plugin that builds background + content scripts as single files via esbuild,
 * then copies the manifest and icons into dist.
 *
 * This replaces @crxjs/vite-plugin which caused infinite-reload bugs
 * due to its HMR client and code-split service worker loader.
 */
function extensionBuildPlugin() {
  return {
    name: 'extension-build',
    async writeBundle() {
      const outDir = resolve(__dirname, 'dist');

      // Build background service worker as a single IIFE file (no ES module imports)
      // Avoids Brave/Chromium bugs with module service worker reload
      await esbuild({
        entryPoints: [resolve(__dirname, 'src/background.ts')],
        bundle: true,
        outfile: resolve(outDir, 'background.js'),
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        tsconfig: resolve(__dirname, '../../tsconfig.base.json'),
      });

      // Build content script as a single IIFE file
      await esbuild({
        entryPoints: [resolve(__dirname, 'src/content.ts')],
        bundle: true,
        outfile: resolve(outDir, 'content.js'),
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        tsconfig: resolve(__dirname, '../../tsconfig.base.json'),
      });

      // Copy manifest with corrected paths for dist
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
      manifest.background.service_worker = 'background.js';
      delete manifest.background.type; // Remove "type": "module" — use classic script for Brave compat
      manifest.content_scripts[0].js = ['content.js'];
      writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      // Copy icons
      const iconsDir = resolve(outDir, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      cpSync(resolve(__dirname, 'icons'), iconsDir, { recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [extensionBuildPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel/sidepanel.html'),
        options: resolve(__dirname, 'options/options.html'),
      },
    },
  },
  resolve: {
    dedupe: ['@pluckk/shared'],
  },
});
