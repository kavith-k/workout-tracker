import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Use /data/ when running in Docker (volume mount), otherwise ./data/ for local dev
const dbPath = existsSync('/data') ? '/data/workout-tracker.db' : './data/workout-tracker.db';

mkdirSync(dirname(dbPath), { recursive: true });
const client = new Database(dbPath);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });

migrate(db, { migrationsFolder: './drizzle' });
