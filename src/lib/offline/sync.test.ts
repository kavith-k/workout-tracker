import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { QueuedAction } from './queue';

// --- Mocks ---

const queueMock = {
	getQueuedActions: vi.fn<() => Promise<QueuedAction[]>>(),
	removeFromQueue: vi.fn<(id: string) => Promise<void>>(),
	incrementRetryCount: vi.fn<(id: string) => Promise<number>>(),
	MAX_RETRY_COUNT: 10
};

const storesMock = {
	offlineState: { isOnline: true, isSyncing: false, pendingSyncCount: 0 },
	updatePendingCount: vi.fn<() => Promise<void>>()
};

vi.mock('./queue', () => queueMock);
vi.mock('./stores.svelte', () => storesMock);

// Mock global fetch
const mockFetch = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal('fetch', mockFetch);

const { syncQueue } = await import('./sync');

function makeAction(overrides: Partial<QueuedAction> = {}): QueuedAction {
	return {
		id: overrides.id ?? 'action-1',
		timestamp: overrides.timestamp ?? Date.now(),
		action: overrides.action ?? 'UPDATE_SET',
		payload: overrides.payload ?? { setLogId: 1, weight: 80 },
		retryCount: overrides.retryCount ?? 0
	};
}

function okResponse(): Response {
	return new Response(JSON.stringify({ success: true }), { status: 200 });
}

function errorResponse(status = 500): Response {
	return new Response(JSON.stringify({ success: false, error: 'fail' }), { status });
}

describe('sync engine retry and discard behaviour', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		storesMock.offlineState.isOnline = true;
		storesMock.offlineState.isSyncing = false;
		storesMock.offlineState.pendingSyncCount = 0;
		queueMock.getQueuedActions.mockResolvedValue([]);
		queueMock.removeFromQueue.mockResolvedValue(undefined);
		queueMock.incrementRetryCount.mockResolvedValue(1);
		storesMock.updatePendingCount.mockResolvedValue(undefined);
	});

	describe('successful sync', () => {
		it('removes action from queue on 200 response', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(okResponse());

			await syncQueue();

			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
			expect(queueMock.incrementRetryCount).not.toHaveBeenCalled();
		});

		it('processes multiple actions in order', async () => {
			const actions = [
				makeAction({ id: 'a1', timestamp: 1 }),
				makeAction({ id: 'a2', timestamp: 2 }),
				makeAction({ id: 'a3', timestamp: 3 })
			];
			queueMock.getQueuedActions.mockResolvedValue(actions);
			mockFetch.mockResolvedValue(okResponse());

			await syncQueue();

			expect(queueMock.removeFromQueue).toHaveBeenCalledTimes(3);
			const callOrder = (queueMock.removeFromQueue as Mock).mock.calls.map((c: unknown[]) => c[0]);
			expect(callOrder).toEqual(['a1', 'a2', 'a3']);
		});

		it('does nothing when queue is empty', async () => {
			queueMock.getQueuedActions.mockResolvedValue([]);

			await syncQueue();

			expect(mockFetch).not.toHaveBeenCalled();
			expect(queueMock.removeFromQueue).not.toHaveBeenCalled();
		});
	});

	describe('retry on failure', () => {
		it('increments retry count on server error', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(errorResponse(500));
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).not.toHaveBeenCalled();
		});

		it('increments retry count on 400 response', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(errorResponse(400));
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).not.toHaveBeenCalled();
		});

		it('increments retry count on network error', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).not.toHaveBeenCalled();
		});
	});

	describe('discard after max retries', () => {
		it('removes action when retry count exceeds MAX_RETRY_COUNT on server error', async () => {
			const action = makeAction({ id: 'a1', retryCount: 10 });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(errorResponse(500));
			// incrementRetryCount returns 11 (exceeds MAX_RETRY_COUNT of 10)
			queueMock.incrementRetryCount.mockResolvedValue(11);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
		});

		it('removes action when retry count exceeds MAX_RETRY_COUNT on network error', async () => {
			const action = makeAction({ id: 'a1', retryCount: 10 });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
			queueMock.incrementRetryCount.mockResolvedValue(11);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
		});

		it('keeps action at exactly MAX_RETRY_COUNT', async () => {
			const action = makeAction({ id: 'a1', retryCount: 9 });
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(errorResponse(500));
			// incrementRetryCount returns 10 (equals MAX_RETRY_COUNT, not yet exceeded)
			queueMock.incrementRetryCount.mockResolvedValue(10);

			await syncQueue();

			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).not.toHaveBeenCalled();
		});
	});

	describe('partial sync failure', () => {
		it('continues processing after a failed action', async () => {
			const actions = [
				makeAction({ id: 'a1', timestamp: 1 }),
				makeAction({ id: 'a2', timestamp: 2 }),
				makeAction({ id: 'a3', timestamp: 3 })
			];
			queueMock.getQueuedActions.mockResolvedValue(actions);
			// a1 succeeds, a2 fails (400), a3 succeeds
			mockFetch
				.mockResolvedValueOnce(okResponse())
				.mockResolvedValueOnce(errorResponse(400))
				.mockResolvedValueOnce(okResponse());
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			// a1 and a3 removed; a2 retried
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a3');
			expect(queueMock.removeFromQueue).not.toHaveBeenCalledWith('a2');
			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a2');
		});

		it('handles network drop mid-batch (remaining actions also fail)', async () => {
			const actions = [
				makeAction({ id: 'a1', timestamp: 1 }),
				makeAction({ id: 'a2', timestamp: 2 }),
				makeAction({ id: 'a3', timestamp: 3 })
			];
			queueMock.getQueuedActions.mockResolvedValue(actions);
			// a1 succeeds, a2 and a3 fail with network error
			mockFetch
				.mockResolvedValueOnce(okResponse())
				.mockRejectedValueOnce(new TypeError('Failed to fetch'))
				.mockRejectedValueOnce(new TypeError('Failed to fetch'));
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			// a1 removed, a2 and a3 retried
			expect(queueMock.removeFromQueue).toHaveBeenCalledTimes(1);
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a2');
			expect(queueMock.incrementRetryCount).toHaveBeenCalledWith('a3');
		});
	});

	describe('isSyncing guard', () => {
		it('skips sync when already syncing', async () => {
			storesMock.offlineState.isSyncing = true;
			queueMock.getQueuedActions.mockResolvedValue([makeAction()]);

			await syncQueue();

			expect(queueMock.getQueuedActions).not.toHaveBeenCalled();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('skips sync when offline', async () => {
			storesMock.offlineState.isOnline = false;
			queueMock.getQueuedActions.mockResolvedValue([makeAction()]);

			await syncQueue();

			expect(queueMock.getQueuedActions).not.toHaveBeenCalled();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('sets isSyncing to true during sync and false after', async () => {
			const action = makeAction();
			queueMock.getQueuedActions.mockResolvedValue([action]);

			let syncingDuringFetch = false;
			mockFetch.mockImplementation(async () => {
				syncingDuringFetch = storesMock.offlineState.isSyncing;
				return okResponse();
			});

			await syncQueue();

			expect(syncingDuringFetch).toBe(true);
			expect(storesMock.offlineState.isSyncing).toBe(false);
		});

		it('resets isSyncing to false even when all actions fail', async () => {
			const action = makeAction();
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
			queueMock.incrementRetryCount.mockResolvedValue(1);

			await syncQueue();

			expect(storesMock.offlineState.isSyncing).toBe(false);
		});
	});

	describe('pending count updates', () => {
		it('updates pending count after each action and at end', async () => {
			const actions = [
				makeAction({ id: 'a1', timestamp: 1 }),
				makeAction({ id: 'a2', timestamp: 2 })
			];
			queueMock.getQueuedActions.mockResolvedValue(actions);
			mockFetch.mockResolvedValue(okResponse());

			await syncQueue();

			// Once at the start, once per action, once at the end = 4 calls
			expect(storesMock.updatePendingCount).toHaveBeenCalledTimes(4);
		});
	});

	describe('concurrency', () => {
		it('second call is suppressed when first has set isSyncing', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);

			// Make fetch slow so we can trigger a concurrent call after isSyncing is set
			let resolveFirstFetch: (v: Response) => void;
			mockFetch.mockImplementationOnce(() => new Promise<Response>((r) => (resolveFirstFetch = r)));

			const firstSync = syncQueue();

			// Flush microtasks so the first call gets past getQueuedActions and
			// sets isSyncing = true before we start the second call
			await vi.waitFor(() => {
				expect(storesMock.offlineState.isSyncing).toBe(true);
			});

			// Now trigger a second sync -- it should be suppressed by the guard
			const secondSync = syncQueue();
			await secondSync;

			// Only the first call should have fetched
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Resolve the first fetch to let it complete
			resolveFirstFetch!(okResponse());
			await firstSync;

			expect(storesMock.offlineState.isSyncing).toBe(false);
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
		});

		it('processes only the snapshot of queued actions', async () => {
			// The sync engine snapshots the queue at the start via getQueuedActions.
			// Actions added afterwards are not processed until the next cycle.
			const initialActions = [makeAction({ id: 'a1', timestamp: 1 })];
			queueMock.getQueuedActions.mockResolvedValue(initialActions);
			mockFetch.mockResolvedValue(okResponse());

			await syncQueue();

			// Only one fetch call for the one action in the snapshot
			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(queueMock.removeFromQueue).toHaveBeenCalledTimes(1);
			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
		});
	});

	describe('isSyncing flag crash recovery', () => {
		it('resets isSyncing when initial updatePendingCount throws', async () => {
			const action = makeAction();
			queueMock.getQueuedActions.mockResolvedValue([action]);
			storesMock.updatePendingCount.mockRejectedValueOnce(new Error('IndexedDB read failed'));

			// syncQueue should not leave isSyncing stuck
			await expect(syncQueue()).rejects.toThrow('IndexedDB read failed');

			expect(storesMock.offlineState.isSyncing).toBe(false);
		});

		it('resets isSyncing when in-loop updatePendingCount throws', async () => {
			const action = makeAction();
			queueMock.getQueuedActions.mockResolvedValue([action]);
			mockFetch.mockResolvedValue(okResponse());

			// First call (start of sync) succeeds, second call (after action) throws
			storesMock.updatePendingCount
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('IndexedDB write failed'));

			await expect(syncQueue()).rejects.toThrow('IndexedDB write failed');

			expect(storesMock.offlineState.isSyncing).toBe(false);
		});

		it('allows subsequent syncs after a crash', async () => {
			const action = makeAction({ id: 'a1' });
			queueMock.getQueuedActions.mockResolvedValue([action]);

			// First sync crashes
			storesMock.updatePendingCount.mockRejectedValueOnce(new Error('crash'));

			await expect(syncQueue()).rejects.toThrow('crash');
			expect(storesMock.offlineState.isSyncing).toBe(false);

			// Second sync should work normally
			storesMock.updatePendingCount.mockResolvedValue(undefined);
			mockFetch.mockResolvedValue(okResponse());

			await syncQueue();

			expect(queueMock.removeFromQueue).toHaveBeenCalledWith('a1');
			expect(storesMock.offlineState.isSyncing).toBe(false);
		});
	});
});
