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
    // Default gate collects every suite, matching docs/testing.md placement:
    // colocated app suites (src/**), the react/gas trees under tests/, and the
    // colocated node-tooling suites under scripts/. Nothing is silently skipped.
    include: [
      'tests/react/**/*.test.{ts,tsx}',
      'tests/gas/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.{mjs,cjs}',
    ],
    setupFiles: ['tests/react/setup.ts'],
    environment: 'jsdom',
  },
})
