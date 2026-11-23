import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hướng dẫn agent nằm ở CLAUDE.md; không để Next sinh AGENTS.md.
  agentRules: false,
  // Monorepo: trace từ gốc repo để chép templates/*.xlsx vào route tải file.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  outputFileTracingIncludes: { '/api/v1/reports/[type]/file': ['../../templates/*.xlsx'] },
  transpilePackages: [
    '@ts24-htkh/shared',
    '@ts24-htkh/platform',
    '@ts24-htkh/core',
    '@ts24-htkh/db',
    '@ts24-htkh/storage',
    '@ts24-htkh/xlsx-report',
  ],
};

export default nextConfig;
