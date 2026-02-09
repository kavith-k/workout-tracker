import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = './data/e2e-test.db';

export default function globalSetup() {
	// Remove existing test database for a clean slate
	if (fs.existsSync(DB_PATH)) {
		fs.unlinkSync(DB_PATH);
	}

	// Ensure data directory exists
	const dir = path.dirname(DB_PATH);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Create database and run migrations
	const client = new Database(DB_PATH);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');

	const db = drizzle(client);
	migrate(db, { migrationsFolder: './drizzle' });

	client.close();
}
