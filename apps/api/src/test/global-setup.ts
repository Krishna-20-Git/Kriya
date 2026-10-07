import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Recreates the test schema from the committed migrations, so tests also prove the migrations work. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pms_test';
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
    const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (error) {
    throw new Error(`Could not prepare the test database at ${url.replace(/:[^:@/]+@/, ':***@')}. Is PostgreSQL running?\n${String(error)}`);
  } finally {
    await pool.end();
  }
}
