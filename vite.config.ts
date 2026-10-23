/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    // Single self-contained HTML for the Apps Script iframe sandbox:
    // no CDN requests, everything inlined (including fonts referenced by CSS).
    assetsInlineLimit: 100_000_000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Always leave the machine-readable report behind (`.vitest/` is
    // gitignored); agents parse it when tooling swallows stdout.
    outputFile: { json: './.vitest/json/output.json' },
    // One jsdom environment per worker instead of per file (~29 s of the
    // 36 s suite was env-creation at 9 files), keeping per-file isolation.
    pool: 'vmThreads',
  },
})
