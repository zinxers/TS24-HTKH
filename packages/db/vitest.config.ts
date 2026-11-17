import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.db.test.ts'],
    alias: { 'server-only': fileURLToPath(new URL('./src/server-only.stub.ts', import.meta.url)) },
  },
});
