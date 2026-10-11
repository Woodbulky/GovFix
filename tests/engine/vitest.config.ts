import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Engine tests run against the cloud project (no local DB). Secrets come from the root .env.
export default defineConfig({
  test: { env: loadEnv('', process.cwd(), ''), testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
});
