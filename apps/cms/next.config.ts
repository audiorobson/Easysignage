import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `standalone` usa symlinks no trace; no Windows falha (EPERM) sem Developer Mode. Só em build Docker. */
const dockerBuild = process.env.DOCKER_BUILD === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(dockerBuild
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: path.join(__dirname, '../..'),
      }
    : {}),
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg' }];
  },
};

export default nextConfig;
