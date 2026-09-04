import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, build: { outDir: 'dist/web', emptyOutDir: true }, server: { proxy: { '/api': 'http://127.0.0.1:4310' } } });
