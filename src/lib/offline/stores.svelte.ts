import { getQueueLength } from './queue';

class OfflineState {
	isOnline = $state(true);
	pendingSyncCount = $state(0);
	isSyncing = $state(false);
}

export const offlineState = new OfflineState();

export function initOfflineListeners(): () => void {
	if (typeof window === 'undefined') return () => {};

	offlineState.isOnline = navigator.onLine;

	function handleOnline() {
		offlineState.isOnline = true;
	}

	function handleOffline() {
		offlineState.isOnline = false;
	}

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
}

export async function updatePendingCount(): Promise<void> {
	offlineState.pendingSyncCount = await getQueueLength();
}
