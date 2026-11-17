import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// Chạy luật thật trong .dependency-cruiser.cjs trên cây file mẫu dựng trong thư mục tạm.
const root = fileURLToPath(new URL('..', import.meta.url));
const config = join(root, '.dependency-cruiser.cjs');
const bin = join(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');

const target: Record<string, string> = {
  core: 'packages/core/src/index.ts',
  db: 'packages/db/src/index.ts',
  storage: 'packages/storage/src/index.ts',
  'xlsx-report': 'packages/xlsx-report/src/index.ts',
  shared: 'packages/shared/src/index.ts',
  platform: 'packages/platform/src/index.ts',
};

let dir = '';
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function violations(from: string, to: keyof typeof target, typeOnly = false): string[] {
  dir = mkdtempSync(join(tmpdir(), 'depcruise-'));
  writeFileSync(join(dir, 'tsconfig.base.json'), '{ "compilerOptions": {} }');
  const toFile = target[to]!;
  mkdirSync(join(dir, dirname(toFile)), { recursive: true });
  writeFileSync(join(dir, toFile), 'export type X = 1;\nexport const x = 1;\n');
  const rel = toFile.replace(/\.ts$/, '');
  const up = '../'.repeat(from.split('/').length - 1);
  const line = typeOnly
    ? `import type { X } from '${up}${rel}';\nexport type Y = X;\n`
    : `import { x } from '${up}${rel}';\nexport const y = x;\n`;
  mkdirSync(join(dir, dirname(from)), { recursive: true });
  writeFileSync(join(dir, from), line);
  const r = spawnSync(process.execPath, [bin, from, '--config', config, '--output-type', 'json'], {
    cwd: dir,
    encoding: 'utf8',
  });
  const out = JSON.parse(r.stdout) as { summary: { violations: { rule: { name: string } }[] } };
  return out.summary.violations.map((v) => v.rule.name);
}

describe('luật depcruise chặn import sai lớp', () => {
  it.each([
    ['apps/web/src/app/error.tsx', 'core', false, 'giao-dien-khong-goi-backend-db'],
    ['apps/web/src/middleware.ts', 'db', false, 'giao-dien-khong-goi-backend-db'],
    ['apps/web/src/app/(pages)/page.tsx', 'core', true, 'giao-dien-khong-goi-backend-db'],
    ['apps/web/src/app/api/v1/x/route.ts', 'xlsx-report', false, 'api-chi-goi-core-shared'],
    ['apps/web/src/app/api/v1/x/route.ts', 'platform', false, 'api-chi-goi-core-shared'],
    ['packages/db/src/a.ts', 'storage', false, 'tang-duoi-chi-goi-shared'],
    ['packages/xlsx-report/src/a.ts', 'core', false, 'tang-duoi-chi-goi-shared'],
    ['packages/shared/src/a.ts', 'core', true, 'shared-khong-phu-thuoc'],
    ['packages/platform/src/a.ts', 'shared', false, 'platform-khong-phu-thuoc'],
    ['packages/core/src/a.ts', 'platform', false, 'core-chi-goi-tang-duoi'],
  ] as const)('%s → %s (type=%s) bị %s', (from, to, typeOnly, rule) => {
    expect(violations(from, to, typeOnly)).toContain(rule);
  });
});

describe('luật depcruise cho phép import đúng lớp', () => {
  it.each([
    ['apps/web/src/app/(pages)/page.tsx', 'shared'],
    ['apps/web/src/app/(pages)/page.tsx', 'platform'],
    ['apps/web/src/app/api/v1/x/route.ts', 'core'],
    ['apps/web/src/app/api/v1/x/route.ts', 'shared'],
    ['packages/core/src/a.ts', 'db'],
    ['packages/core/src/a.ts', 'xlsx-report'],
    ['packages/db/src/a.ts', 'shared'],
    ['packages/storage/src/a.ts', 'shared'],
  ] as const)('%s → %s hợp lệ', (from, to) => {
    expect(violations(from, to)).toEqual([]);
  });
});
