import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

/** Applies the SQL files in apps/api/drizzle. Works from both src (tsx) and dist (node). */
export const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntryPoint) {
  runMigrations()
    .then(() => {
      console.log('Migrations applied.');
      return pool.end();
    })
    .catch(async (error: unknown) => {
      console.error('Migration failed:', error);
      await pool.end();
      process.exit(1);
    });
}
