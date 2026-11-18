import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: { 'server-only': fileURLToPath(new URL('./src/server-only.stub.ts', import.meta.url)) },
  },
});
