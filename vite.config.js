import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const API_TARGET = process.env.VITE_API_PROXY || 'http://localhost:4000';
// https://vite.dev/config/  (Vitest config lives in vitest.config.ts)
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            // Dev: forward API + docs to the backend so cookies stay same-origin.
            '/api': { target: API_TARGET, changeOrigin: true },
        },
    },
});
