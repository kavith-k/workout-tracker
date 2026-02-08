import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'node:path';

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

export function createTestDb() {
	const client = new Database(':memory:');
	client.pragma('foreign_keys = ON');

	const db = drizzle(client, { schema });
	migrate(db, { migrationsFolder });

	return db;
}
