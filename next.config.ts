import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', 'xlsx', 'pdf-parse', 'mammoth'],
};

export default nextConfig;
