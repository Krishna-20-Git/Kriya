import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a real PostgreSQL database (TEST_DATABASE_URL),
 * never mocks, so SQL, constraints and ownership filters are exercised for real.
 * Files run sequentially because they share one database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pms_test',
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      WEB_ORIGIN: 'http://localhost:5173',
      BCRYPT_ROUNDS: '4',
      LOG_LEVEL: 'silent',
    },
  },
});
