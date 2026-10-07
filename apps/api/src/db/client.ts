import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Managed Postgres (Neon, Render, Supabase) requires TLS.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

/** Either the root database handle or a transaction — repositories accept both. */
export type Database = NodePgDatabase<typeof schema>;
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
