import { openDB, type IDBPDatabase } from 'idb';

export type ActionType =
	| 'UPDATE_SET'
	| 'SKIP_EXERCISE'
	| 'UNSKIP_EXERCISE'
	| 'COMPLETE_WORKOUT'
	| 'ADD_ADHOC'
	| 'ADD_SET'
	| 'REMOVE_SET'
	| 'UPDATE_UNIT';

export interface QueuedAction {
	id: string;
	timestamp: number;
	action: ActionType;
	payload: {
		setLogId?: number;
		weight?: number | null;
		reps?: number | null;
		unit?: 'kg' | 'lbs';
		exerciseLogId?: number;
		exerciseId?: number;
		sessionId?: number;
		exerciseName?: string;
	};
	retryCount: number;
}

const DB_NAME = 'workout-tracker-offline';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
	if (typeof window === 'undefined') return null;
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			}
		});
	}
	return dbPromise;
}

export async function addToQueue(
	action: ActionType,
	payload: QueuedAction['payload']
): Promise<string> {
	const db = getDb();
	if (!db) return '';
	const id = crypto.randomUUID();
	const entry: QueuedAction = {
		id,
		timestamp: Date.now(),
		action,
		payload,
		retryCount: 0
	};
	const resolved = await db;
	await resolved.put(STORE_NAME, entry);
	return id;
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
	const db = getDb();
	if (!db) return [];
	const resolved = await db;
	const all = await resolved.getAll(STORE_NAME);
	return (all as QueuedAction[]).sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeFromQueue(id: string): Promise<void> {
	const db = getDb();
	if (!db) return;
	const resolved = await db;
	await resolved.delete(STORE_NAME, id);
}

export async function incrementRetryCount(id: string): Promise<void> {
	const db = getDb();
	if (!db) return;
	const resolved = await db;
	const entry = (await resolved.get(STORE_NAME, id)) as QueuedAction | undefined;
	if (entry) {
		entry.retryCount++;
		await resolved.put(STORE_NAME, entry);
	}
}

export async function getQueueLength(): Promise<number> {
	const db = getDb();
	if (!db) return 0;
	const resolved = await db;
	return resolved.count(STORE_NAME);
}

export async function clearQueue(): Promise<void> {
	const db = getDb();
	if (!db) return;
	const resolved = await db;
	await resolved.clear(STORE_NAME);
}
