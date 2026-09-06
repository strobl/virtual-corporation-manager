import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Limit concurrent durable SQLite writers on Windows CI while retaining
    // every assertion and deadline; other platforms keep Vitest's default.
    maxWorkers: process.platform === 'win32' ? 2 : undefined,
    testTimeout: 15000,
  },
});
