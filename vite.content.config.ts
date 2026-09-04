import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite build configuration for the content script.
 * Produces a standalone IIFE bundle (content.js) in dist/
 * without wipping previously built UI files.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/contentScript.ts'),
      name: 'ChatGPTExporterContent',
      fileName: () => 'content.js',
      formats: ['iife'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
