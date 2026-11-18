import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path: string) => JSON.parse(readText(path));

// Nguồn: docs/architecture.md mục 2.
const expected: Record<string, string[]> = {
  // zod cho schema dùng chung (Mốc 2b); vẫn không phụ thuộc package nội bộ nào.
  shared: ['zod'],
  platform: [],
  db: ['@ts24-htkh/shared', 'postgres', 'server-only'],
  storage: ['@ts24-htkh/shared', 'server-only'],
  'xlsx-report': ['@ts24-htkh/shared'],
  core: [
    '@ts24-htkh/db',
    '@ts24-htkh/shared',
    '@ts24-htkh/storage',
    '@ts24-htkh/xlsx-report',
    'server-only',
  ],
};

describe('phụ thuộc giữa các package', () => {
  it.each(Object.entries(expected))('%s khai báo đúng dependencies', (p, deps) => {
    const pkg = readJson(`packages/${p}/package.json`);
    expect(pkg.name).toBe(`@ts24-htkh/${p}`);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(deps);
    for (const d of deps.filter((d) => d.startsWith('@ts24-htkh/'))) {
      expect(pkg.dependencies[d]).toBe('workspace:*');
    }
  });

  it.each(['core', 'db', 'storage'])('%s import server-only ở điểm vào', (p) => {
    expect(readText(`packages/${p}/src/index.ts`)).toMatch(/^import 'server-only';/m);
  });
});
