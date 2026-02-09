import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import {
	getSessionsByDate,
	getSessionDetail,
	getHistoryByExercise,
	getExerciseHistory,
	deleteSession,
	deleteExerciseLog
} from './history';
import {
	startWorkout,
	getWorkoutSession,
	updateSetLog,
	completeWorkout,
	skipExercise
} from './workouts';
import { createProgram, addWorkoutDay, addDayExercise, setActiveProgram } from './programs';
import { exercises, exerciseLogs, setLogs, workoutSessions } from '../schema';
import { eq } from 'drizzle-orm';

describe('history queries', () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	/** Helper to create a program with a day and exercises, returns the day. */
	function setupProgramWithDay(
		programName: string,
		dayName: string,
		exerciseNames: string[],
		setsCount = 3
	) {
		const program = createProgram(db, programName);
		setActiveProgram(db, program.id);
		const day = addWorkoutDay(db, program.id, dayName);
		for (const name of exerciseNames) {
			addDayExercise(db, day.id, name, setsCount);
		}
		return { program, day };
	}

	/** Helper to start and complete a workout with specified sets. */
	function completeWorkoutWithSets(
		dayId: number,
		setData: Array<{
			exerciseName: string;
			sets: Array<{ weight: number; reps: number; unit?: 'kg' | 'lbs' }>;
		}>
	) {
		const session = startWorkout(db, dayId);
		const ws = getWorkoutSession(db, session.id)!;

		for (const exercise of setData) {
			const log = ws.exerciseLogs.find((l) => l.exerciseName === exercise.exerciseName);
			if (!log) continue;
			for (let i = 0; i < exercise.sets.length && i < log.sets.length; i++) {
				updateSetLog(db, log.sets[i].id, {
					weight: exercise.sets[i].weight,
					reps: exercise.sets[i].reps,
					unit: exercise.sets[i].unit ?? 'kg'
				});
			}
		}

		completeWorkout(db, session.id);
		return session;
	}

	describe('getSessionsByDate', () => {
		it('returns empty array when no completed sessions exist', () => {
			const result = getSessionsByDate(db);

			expect(result.sessions).toEqual([]);
			expect(result.total).toBe(0);
		});

		it('returns completed sessions ordered by completedAt descending', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const result = getSessionsByDate(db);

			expect(result.sessions).toHaveLength(2);
			expect(result.total).toBe(2);
			// Most recent first
			const [first, second] = result.sessions;
			expect(first.completedAt!.getTime()).toBeGreaterThanOrEqual(second.completedAt!.getTime());
		});

		it('includes exercise counts (total, completed, skipped)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP', 'Flyes']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log Bench Press only; skip OHP explicitly
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			skipExercise(db, ws.exerciseLogs[1].id);
			// Flyes has no sets logged, will be auto-skipped on complete
			completeWorkout(db, session.id);

			const result = getSessionsByDate(db);

			expect(result.sessions).toHaveLength(1);
			const s = result.sessions[0];
			expect(s.exerciseCount).toBe(3);
			expect(s.completedCount).toBe(1);
			expect(s.skippedCount).toBe(2);
		});

		it('respects pagination (page, limit)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// Create 5 completed sessions
			for (let i = 0; i < 5; i++) {
				completeWorkoutWithSets(day.id, [
					{ exerciseName: 'Bench Press', sets: [{ weight: 60 + i * 5, reps: 10 }] }
				]);
			}

			const page1 = getSessionsByDate(db, 1, 2);
			const page2 = getSessionsByDate(db, 2, 2);
			const page3 = getSessionsByDate(db, 3, 2);

			expect(page1.sessions).toHaveLength(2);
			expect(page1.total).toBe(5);
			expect(page2.sessions).toHaveLength(2);
			expect(page2.total).toBe(5);
			expect(page3.sessions).toHaveLength(1);
			expect(page3.total).toBe(5);

			// Ensure no overlap between pages
			const page1Ids = page1.sessions.map((s) => s.id);
			const page2Ids = page2.sessions.map((s) => s.id);
			for (const id of page1Ids) {
				expect(page2Ids).not.toContain(id);
			}
		});

		it('does not include in-progress sessions', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// One completed
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			// One in-progress
			startWorkout(db, day.id);

			const result = getSessionsByDate(db);

			expect(result.sessions).toHaveLength(1);
			expect(result.total).toBe(1);
		});
	});

	describe('getSessionDetail', () => {
		it('returns null for non-existent session', () => {
			expect(getSessionDetail(db, 9999)).toBeNull();
		});

		it('returns session with exercise logs and set logs', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP'], 3);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			updateSetLog(db, ws.exerciseLogs[0].sets[1].id, { weight: 80, reps: 7 });
			completeWorkout(db, session.id);

			const detail = getSessionDetail(db, session.id)!;

			expect(detail.id).toBe(session.id);
			expect(detail.programName).toBe('PPL');
			expect(detail.dayName).toBe('Push');
			expect(detail.exerciseLogs).toHaveLength(2);
			expect(detail.exerciseLogs[0].exerciseName).toBe('Bench Press');
			expect(detail.exerciseLogs[0].sets).toHaveLength(3);
			expect(detail.exerciseLogs[0].sets[0].weight).toBe(80);
			expect(detail.exerciseLogs[0].sets[0].reps).toBe(8);
			expect(detail.exerciseLogs[1].exerciseName).toBe('OHP');
			expect(detail.exerciseLogs[1].sets).toHaveLength(3);
		});

		it('includes skipped exercises', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			skipExercise(db, ws.exerciseLogs[1].id);
			completeWorkout(db, session.id);

			const detail = getSessionDetail(db, session.id)!;

			expect(detail.exerciseLogs).toHaveLength(2);
			expect(detail.exerciseLogs[0].status).toBe('logged');
			expect(detail.exerciseLogs[1].status).toBe('skipped');
		});
	});

	describe('getHistoryByExercise', () => {
		it('returns empty array when no history exists', () => {
			const result = getHistoryByExercise(db);

			expect(result).toEqual([]);
		});

		it('returns exercises with session count and last performed date', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const result = getHistoryByExercise(db);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Bench Press');
			expect(result[0].sessionCount).toBe(2);
			expect(result[0].lastPerformed).toBeDefined();
		});

		it('orders by exercise name alphabetically', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', [
				'Overhead Press',
				'Bench Press',
				'Cable Flyes'
			]);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Overhead Press', sets: [{ weight: 40, reps: 10 }] },
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] },
				{ exerciseName: 'Cable Flyes', sets: [{ weight: 15, reps: 12 }] }
			]);

			const result = getHistoryByExercise(db);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe('Bench Press');
			expect(result[1].name).toBe('Cable Flyes');
			expect(result[2].name).toBe('Overhead Press');
		});

		it('counts distinct sessions (not duplicate entries)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// Complete one session (Bench Press appears once per session)
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);

			const result = getHistoryByExercise(db);

			expect(result).toHaveLength(1);
			expect(result[0].sessionCount).toBe(1);
		});

		it('does not include exercises only in in-progress sessions', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// Start but do not complete
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			const result = getHistoryByExercise(db);

			expect(result).toEqual([]);
		});
	});

	describe('getExerciseHistory', () => {
		it('returns empty object when no history exists for exercise', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const result = getExerciseHistory(db, ex.id);

			expect(result.entries).toEqual([]);
			expect(result.total).toBe(0);
		});

		it('returns historical logs for a specific exercise', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			const result = getExerciseHistory(db, ex.id);

			expect(result.entries).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.entries[0].programName).toBe('PPL');
			expect(result.entries[0].dayName).toBe('Push');
		});

		it('includes sets data', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 3);

			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 60, reps: 10 },
						{ weight: 70, reps: 8 },
						{ weight: 80, reps: 5 }
					]
				}
			]);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			const result = getExerciseHistory(db, ex.id);

			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].sets).toHaveLength(3);
			expect(result.entries[0].sets[0].weight).toBe(60);
			expect(result.entries[0].sets[0].reps).toBe(10);
			expect(result.entries[0].sets[1].weight).toBe(70);
			expect(result.entries[0].sets[2].weight).toBe(80);
		});

		it('orders by completedAt descending', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			const result = getExerciseHistory(db, ex.id);

			expect(result.entries).toHaveLength(2);
			expect(result.entries[0].completedAt.getTime()).toBeGreaterThanOrEqual(
				result.entries[1].completedAt.getTime()
			);
		});

		it('respects pagination', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			for (let i = 0; i < 5; i++) {
				completeWorkoutWithSets(day.id, [
					{ exerciseName: 'Bench Press', sets: [{ weight: 60 + i * 5, reps: 10 }] }
				]);
			}

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const page1 = getExerciseHistory(db, ex.id, 1, 2);
			const page2 = getExerciseHistory(db, ex.id, 2, 2);
			const page3 = getExerciseHistory(db, ex.id, 3, 2);

			expect(page1.entries).toHaveLength(2);
			expect(page1.total).toBe(5);
			expect(page2.entries).toHaveLength(2);
			expect(page3.entries).toHaveLength(1);
		});

		it('includes skipped entries', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log Bench Press, skip OHP
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			skipExercise(db, ws.exerciseLogs[1].id);
			completeWorkout(db, session.id);

			const ohpEx = db.select().from(exercises).where(eq(exercises.name, 'OHP')).get()!;
			const result = getExerciseHistory(db, ohpEx.id);

			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].status).toBe('skipped');
		});
	});

	describe('deleteSession', () => {
		it('deletes a session and its exercise logs and set logs (cascade)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const session = completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			deleteSession(db, session.id);

			// Session gone
			const sessionRow = db
				.select()
				.from(workoutSessions)
				.where(eq(workoutSessions.id, session.id))
				.get();
			expect(sessionRow).toBeUndefined();

			// Exercise logs gone (cascade)
			const logs = db
				.select()
				.from(exerciseLogs)
				.where(eq(exerciseLogs.sessionId, session.id))
				.all();
			expect(logs).toHaveLength(0);

			// Set logs gone (cascade from exercise logs)
			const sets = db.select().from(setLogs).all();
			expect(sets).toHaveLength(0);
		});

		it('deleted session no longer appears in getSessionsByDate', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const session = completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			expect(getSessionsByDate(db).sessions).toHaveLength(1);

			deleteSession(db, session.id);

			expect(getSessionsByDate(db).sessions).toHaveLength(0);
			expect(getSessionsByDate(db).total).toBe(0);
		});
	});

	describe('deleteExerciseLog', () => {
		it('deletes a single exercise log and its set logs (cascade)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			updateSetLog(db, ws.exerciseLogs[1].sets[0].id, { weight: 40, reps: 10 });
			completeWorkout(db, session.id);

			const benchLogId = ws.exerciseLogs[0].id;

			deleteExerciseLog(db, benchLogId);

			// Exercise log gone
			const deletedLog = db
				.select()
				.from(exerciseLogs)
				.where(eq(exerciseLogs.id, benchLogId))
				.get();
			expect(deletedLog).toBeUndefined();

			// Its set logs gone (cascade)
			const deletedSets = db
				.select()
				.from(setLogs)
				.where(eq(setLogs.exerciseLogId, benchLogId))
				.all();
			expect(deletedSets).toHaveLength(0);
		});

		it('session still exists after deleting one exercise log', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			updateSetLog(db, ws.exerciseLogs[1].sets[0].id, { weight: 40, reps: 10 });
			completeWorkout(db, session.id);

			deleteExerciseLog(db, ws.exerciseLogs[0].id);

			// Session still exists
			const sessionRow = db
				.select()
				.from(workoutSessions)
				.where(eq(workoutSessions.id, session.id))
				.get();
			expect(sessionRow).toBeDefined();
			expect(sessionRow!.status).toBe('completed');

			// Remaining exercise log still present
			const remainingLogs = db
				.select()
				.from(exerciseLogs)
				.where(eq(exerciseLogs.sessionId, session.id))
				.all();
			expect(remainingLogs).toHaveLength(1);
			expect(remainingLogs[0].exerciseName).toBe('OHP');
		});
	});
});
