import { getQueuedActions, removeFromQueue, incrementRetryCount, MAX_RETRY_COUNT } from './queue';
import { offlineState, updatePendingCount } from './stores.svelte';

let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function syncQueue(): Promise<void> {
	if (offlineState.isSyncing) return;
	if (!offlineState.isOnline) return;

	const queue = await getQueuedActions();
	if (queue.length === 0) return;

	offlineState.isSyncing = true;

	try {
		await updatePendingCount();

		for (const action of queue) {
			try {
				const response = await fetch('/api/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: action.action, payload: action.payload })
				});

				if (response.ok) {
					await removeFromQueue(action.id);
				} else {
					const retries = await incrementRetryCount(action.id);
					if (retries > MAX_RETRY_COUNT) {
						await removeFromQueue(action.id);
					}
				}
			} catch {
				const retries = await incrementRetryCount(action.id);
				if (retries > MAX_RETRY_COUNT) {
					await removeFromQueue(action.id);
				}
			}
			await updatePendingCount();
		}
	} finally {
		offlineState.isSyncing = false;
	}

	await updatePendingCount();
}

export function startPeriodicSync(): void {
	if (syncInterval) return;
	syncInterval = setInterval(syncQueue, 30000);
}

export function stopPeriodicSync(): void {
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
	}
}

export function setupSyncListeners(): () => void {
	if (typeof window === 'undefined') return () => {};

	function handleOnline() {
		syncQueue();
	}

	window.addEventListener('online', handleOnline);
	startPeriodicSync();
	syncQueue();

	return () => {
		window.removeEventListener('online', handleOnline);
		stopPeriodicSync();
	};
}
