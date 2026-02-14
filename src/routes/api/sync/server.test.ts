import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all query functions before importing the handler
const mocks = {
	updateSetLog: vi.fn(),
	completeWorkout: vi.fn(),
	addAdhocExercise: vi.fn(),
	addSetToExerciseLog: vi.fn(),
	removeSetFromExerciseLog: vi.fn(),
	updateExerciseUnitPreference: vi.fn()
};

vi.mock('$lib/server/db/queries/workouts', () => mocks);
vi.mock('$lib/server/db', () => ({ db: {} }));

const { POST } = await import('./+server');

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/sync', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function callSync(action: string, payload: Record<string, unknown> = {}) {
	const request = makeRequest({ action, payload });
	// The handler expects a RequestEvent; we only need request
	const response = await POST({ request } as never);
	return {
		status: response.status,
		body: await response.json()
	};
}

describe('sync endpoint input validation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('unknown action', () => {
		it('rejects unknown action with 400', async () => {
			const { status, body } = await callSync('INVALID_ACTION');

			expect(status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.error).toBe('Unknown action');
		});
	});

	describe('SAVE_EXERCISE', () => {
		it('accepts valid payload', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				exerciseId: 5,
				sets: [
					{ setLogId: 1, weight: 80, reps: 10, unit: 'kg' },
					{ setLogId: 2, weight: 85, reps: 8, unit: 'kg' }
				]
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.updateSetLog).toHaveBeenCalledTimes(2);
		});

		it('rejects missing exerciseLogId', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				sets: [{ setLogId: 1, weight: 80, reps: 10, unit: 'kg' }]
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});

		it('rejects missing sets', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/sets/);
		});

		it('rejects non-array sets', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: 'not-an-array'
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/sets/);
		});

		it('rejects invalid unit in set', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: [{ setLogId: 1, weight: 80, reps: 10, unit: 'stones' }]
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/unit/);
		});

		it('skips placeholder sets with non-positive setLogId', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: [
					{ setLogId: -1, weight: 80, reps: 10, unit: 'kg' },
					{ setLogId: 2, weight: 85, reps: 8, unit: 'kg' }
				]
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			// Only the set with positive ID should be processed
			expect(mocks.updateSetLog).toHaveBeenCalledTimes(1);
		});

		it('updates exercise unit preference when exerciseId given', async () => {
			await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				exerciseId: 5,
				sets: [{ setLogId: 1, weight: 80, reps: 10, unit: 'lbs' }]
			});

			expect(mocks.updateExerciseUnitPreference).toHaveBeenCalledWith(expect.anything(), 5, 'lbs');
		});

		it('does not update exercise unit preference without exerciseId', async () => {
			await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: [{ setLogId: 1, weight: 80, reps: 10, unit: 'kg' }]
			});

			expect(mocks.updateExerciseUnitPreference).not.toHaveBeenCalled();
		});

		it('handles null weight and reps', async () => {
			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: [{ setLogId: 1, weight: null, reps: null, unit: 'kg' }]
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.updateSetLog).toHaveBeenCalledWith(expect.anything(), 1, {
				weight: null,
				reps: null,
				unit: 'kg'
			});
		});
	});

	describe('COMPLETE_WORKOUT', () => {
		it('accepts valid sessionId', async () => {
			const { status, body } = await callSync('COMPLETE_WORKOUT', { sessionId: 1 });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.completeWorkout).toHaveBeenCalledOnce();
		});

		it('rejects missing sessionId', async () => {
			const { status, body } = await callSync('COMPLETE_WORKOUT', {});

			expect(status).toBe(400);
			expect(body.error).toMatch(/sessionId/);
		});

		it('rejects non-integer sessionId', async () => {
			const { status, body } = await callSync('COMPLETE_WORKOUT', { sessionId: 1.7 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/sessionId/);
		});
	});

	describe('ADD_ADHOC', () => {
		it('accepts valid payload', async () => {
			const { status, body } = await callSync('ADD_ADHOC', {
				sessionId: 1,
				exerciseName: 'Lateral Raise'
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.addAdhocExercise).toHaveBeenCalledWith(expect.anything(), 1, 'Lateral Raise');
		});

		it('rejects missing sessionId', async () => {
			const { status, body } = await callSync('ADD_ADHOC', { exerciseName: 'Curl' });

			expect(status).toBe(400);
			expect(body.error).toMatch(/sessionId/);
		});

		it('rejects missing exerciseName', async () => {
			const { status, body } = await callSync('ADD_ADHOC', { sessionId: 1 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseName/);
		});

		it('rejects empty exerciseName', async () => {
			const { status, body } = await callSync('ADD_ADHOC', {
				sessionId: 1,
				exerciseName: ''
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseName/);
		});

		it('rejects whitespace-only exerciseName', async () => {
			const { status, body } = await callSync('ADD_ADHOC', {
				sessionId: 1,
				exerciseName: '   '
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseName/);
		});

		it('trims exerciseName before passing to query', async () => {
			await callSync('ADD_ADHOC', {
				sessionId: 1,
				exerciseName: '  Lateral Raise  '
			});

			expect(mocks.addAdhocExercise).toHaveBeenCalledWith(expect.anything(), 1, 'Lateral Raise');
		});

		it('rejects non-string exerciseName', async () => {
			const { status, body } = await callSync('ADD_ADHOC', {
				sessionId: 1,
				exerciseName: 123
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseName/);
		});
	});

	describe('ADD_SET', () => {
		it('accepts valid exerciseLogId', async () => {
			const { status, body } = await callSync('ADD_SET', { exerciseLogId: 1 });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.addSetToExerciseLog).toHaveBeenCalledOnce();
		});

		it('rejects missing exerciseLogId', async () => {
			const { status, body } = await callSync('ADD_SET', {});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});

		it('rejects negative exerciseLogId', async () => {
			const { status, body } = await callSync('ADD_SET', { exerciseLogId: -5 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});
	});

	describe('REMOVE_SET', () => {
		it('accepts valid setLogId', async () => {
			const { status, body } = await callSync('REMOVE_SET', { setLogId: 1 });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.removeSetFromExerciseLog).toHaveBeenCalledOnce();
		});

		it('rejects missing setLogId', async () => {
			const { status, body } = await callSync('REMOVE_SET', {});

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});

		it('rejects zero setLogId', async () => {
			const { status, body } = await callSync('REMOVE_SET', { setLogId: 0 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});
	});

	describe('server error handling', () => {
		it('returns 500 when query function throws', async () => {
			mocks.updateSetLog.mockImplementation(() => {
				throw new Error('Database failure');
			});

			const { status, body } = await callSync('SAVE_EXERCISE', {
				exerciseLogId: 1,
				sets: [{ setLogId: 1, weight: 80, reps: 10, unit: 'kg' }]
			});

			expect(status).toBe(500);
			expect(body.success).toBe(false);
			expect(body.error).toBe('Database failure');
		});
	});
});
