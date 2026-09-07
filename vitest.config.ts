import { defineConfig } from 'vitest/config';

// Standalone Vitest config. No Vite plugins needed — esbuild transpiles TSX with
// the automatic JSX runtime (tsconfig `jsx: react-jsx`).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
