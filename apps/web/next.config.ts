import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
