import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all query functions before importing the handler
const mocks = {
	updateSetLog: vi.fn(),
	skipExercise: vi.fn(),
	unskipExercise: vi.fn(),
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

	describe('UPDATE_SET', () => {
		it('accepts valid payload', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: 80,
				reps: 10,
				unit: 'kg'
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.updateSetLog).toHaveBeenCalledOnce();
		});

		it('rejects missing setLogId', async () => {
			const { status, body } = await callSync('UPDATE_SET', { weight: 80 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
			expect(mocks.updateSetLog).not.toHaveBeenCalled();
		});

		it('rejects non-integer setLogId', async () => {
			const { status, body } = await callSync('UPDATE_SET', { setLogId: 1.5 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});

		it('rejects negative setLogId', async () => {
			const { status, body } = await callSync('UPDATE_SET', { setLogId: -1 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});

		it('rejects zero setLogId', async () => {
			const { status, body } = await callSync('UPDATE_SET', { setLogId: 0 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});

		it('rejects string setLogId', async () => {
			const { status, body } = await callSync('UPDATE_SET', { setLogId: 'abc' });

			expect(status).toBe(400);
			expect(body.error).toMatch(/setLogId/);
		});

		it('rejects negative weight', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: -5
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/weight/);
		});

		it('rejects string weight', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: 'heavy'
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/weight/);
		});

		it('rejects boolean weight', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: true
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/weight/);
		});

		it('accepts null weight (clearing a field)', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: null
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
		});

		it('accepts zero weight', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				weight: 0
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
		});

		it('rejects negative reps', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				reps: -1
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/reps/);
		});

		it('rejects invalid unit', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				unit: 'stones'
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/unit/);
		});

		it('accepts kg unit', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				unit: 'kg'
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
		});

		it('accepts lbs unit', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				unit: 'lbs'
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
		});

		it('rejects invalid exerciseId when provided', async () => {
			const { status, body } = await callSync('UPDATE_SET', {
				setLogId: 1,
				exerciseId: -1
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseId/);
		});

		it('updates exercise unit preference when unit and exerciseId given', async () => {
			await callSync('UPDATE_SET', {
				setLogId: 1,
				unit: 'lbs',
				exerciseId: 5
			});

			expect(mocks.updateExerciseUnitPreference).toHaveBeenCalledWith(expect.anything(), 5, 'lbs');
		});

		it('does not update exercise unit preference without exerciseId', async () => {
			await callSync('UPDATE_SET', {
				setLogId: 1,
				unit: 'lbs'
			});

			expect(mocks.updateExerciseUnitPreference).not.toHaveBeenCalled();
		});
	});

	describe('SKIP_EXERCISE', () => {
		it('accepts valid exerciseLogId', async () => {
			const { status, body } = await callSync('SKIP_EXERCISE', { exerciseLogId: 1 });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.skipExercise).toHaveBeenCalledOnce();
		});

		it('rejects missing exerciseLogId', async () => {
			const { status, body } = await callSync('SKIP_EXERCISE', {});

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});

		it('rejects non-integer exerciseLogId', async () => {
			const { status, body } = await callSync('SKIP_EXERCISE', { exerciseLogId: 2.5 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});

		it('rejects string exerciseLogId', async () => {
			const { status, body } = await callSync('SKIP_EXERCISE', { exerciseLogId: 'abc' });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
		});
	});

	describe('UNSKIP_EXERCISE', () => {
		it('accepts valid exerciseLogId', async () => {
			const { status, body } = await callSync('UNSKIP_EXERCISE', { exerciseLogId: 3 });

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.unskipExercise).toHaveBeenCalledOnce();
		});

		it('rejects invalid exerciseLogId', async () => {
			const { status, body } = await callSync('UNSKIP_EXERCISE', { exerciseLogId: 0 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseLogId/);
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

	describe('UPDATE_UNIT', () => {
		it('accepts valid payload', async () => {
			const { status, body } = await callSync('UPDATE_UNIT', {
				exerciseId: 1,
				unit: 'lbs'
			});

			expect(status).toBe(200);
			expect(body.success).toBe(true);
			expect(mocks.updateExerciseUnitPreference).toHaveBeenCalledWith(expect.anything(), 1, 'lbs');
		});

		it('rejects missing exerciseId', async () => {
			const { status, body } = await callSync('UPDATE_UNIT', { unit: 'kg' });

			expect(status).toBe(400);
			expect(body.error).toMatch(/exerciseId/);
		});

		it('rejects invalid unit', async () => {
			const { status, body } = await callSync('UPDATE_UNIT', {
				exerciseId: 1,
				unit: 'stone'
			});

			expect(status).toBe(400);
			expect(body.error).toMatch(/unit/);
		});

		it('rejects missing unit', async () => {
			const { status, body } = await callSync('UPDATE_UNIT', { exerciseId: 1 });

			expect(status).toBe(400);
			expect(body.error).toMatch(/unit/);
		});
	});

	describe('server error handling', () => {
		it('returns 500 when query function throws', async () => {
			mocks.skipExercise.mockImplementation(() => {
				throw new Error('Database failure');
			});

			const { status, body } = await callSync('SKIP_EXERCISE', { exerciseLogId: 1 });

			expect(status).toBe(500);
			expect(body.success).toBe(false);
			expect(body.error).toBe('Database failure');
		});
	});
});
