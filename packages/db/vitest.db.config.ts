import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    fileParallelism: false,
    alias: { 'server-only': fileURLToPath(new URL('./src/server-only.stub.ts', import.meta.url)) },
  },
});
