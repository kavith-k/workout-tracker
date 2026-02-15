import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import {
	getInProgressWorkout,
	startWorkout,
	getWorkoutSession,
	updateSetLog,
	skipExercise,
	unskipExercise,
	addAdhocExercise,
	addSetToExerciseLog,
	removeSetFromExerciseLog,
	completeWorkout,
	getWorkoutSummary,
	getPreviousPerformance,
	getMaxPerformance,
	closeStaleWorkouts,
	updateExerciseUnitPreference
} from './workouts';
import { createProgram, addWorkoutDay, addDayExercise, setActiveProgram } from './programs';
import { exercises, workoutSessions } from '../schema';
import { eq } from 'drizzle-orm';

describe('workout queries', () => {
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

	describe('getInProgressWorkout', () => {
		it('returns null when no workout is in progress', () => {
			expect(getInProgressWorkout(db)).toBeNull();
		});

		it('returns the in-progress workout', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			startWorkout(db, day.id);

			const result = getInProgressWorkout(db);

			expect(result).not.toBeNull();
			expect(result!.status).toBe('in_progress');
			expect(result!.dayName).toBe('Push');
		});

		it('does not return completed workouts', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			completeWorkout(db, session.id);

			expect(getInProgressWorkout(db)).toBeNull();
		});
	});

	describe('startWorkout', () => {
		it('creates a new workout session', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const session = startWorkout(db, day.id);

			expect(session.status).toBe('in_progress');
			expect(session.programName).toBe('PPL');
			expect(session.dayName).toBe('Push');
		});

		it('creates exercise logs for each day exercise', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'Overhead Press']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			expect(ws.exerciseLogs).toHaveLength(2);
			expect(ws.exerciseLogs[0].exerciseName).toBe('Bench Press');
			expect(ws.exerciseLogs[1].exerciseName).toBe('Overhead Press');
		});

		it('creates empty set logs based on sets count', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 4);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			expect(ws.exerciseLogs[0].sets).toHaveLength(4);
			for (const set of ws.exerciseLogs[0].sets) {
				expect(set.weight).toBeNull();
				expect(set.reps).toBeNull();
			}
		});

		it('fails if a workout is already in progress', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			startWorkout(db, day.id);

			expect(() => startWorkout(db, day.id)).toThrow('A workout is already in progress');
		});

		it('fails if workout day does not exist', () => {
			expect(() => startWorkout(db, 9999)).toThrow('Workout day not found');
		});

		it('uses the exercise unit preference for set logs', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			db.update(exercises).set({ unitPreference: 'lbs' }).where(eq(exercises.id, ex.id)).run();

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			expect(ws.exerciseLogs[0].sets[0].unit).toBe('lbs');
		});
	});

	describe('getWorkoutSession', () => {
		it('returns null for non-existent session', () => {
			expect(getWorkoutSession(db, 9999)).toBeNull();
		});

		it('returns session with exercise logs and sets', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP'], 3);
			const session = startWorkout(db, day.id);

			const ws = getWorkoutSession(db, session.id)!;

			expect(ws.id).toBe(session.id);
			expect(ws.exerciseLogs).toHaveLength(2);
			expect(ws.exerciseLogs[0].sets).toHaveLength(3);
			expect(ws.exerciseLogs[1].sets).toHaveLength(3);
		});

		it('returns exercise logs in sort order', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', [
				'Bench Press',
				'OHP',
				'Tricep Extension'
			]);
			const session = startWorkout(db, day.id);

			const ws = getWorkoutSession(db, session.id)!;

			expect(ws.exerciseLogs[0].exerciseName).toBe('Bench Press');
			expect(ws.exerciseLogs[1].exerciseName).toBe('OHP');
			expect(ws.exerciseLogs[2].exerciseName).toBe('Tricep Extension');
		});
	});

	describe('updateSetLog', () => {
		it('updates weight and reps', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			const setId = ws.exerciseLogs[0].sets[0].id;

			const updated = updateSetLog(db, setId, { weight: 80, reps: 8 });

			expect(updated!.weight).toBe(80);
			expect(updated!.reps).toBe(8);
		});

		it('updates unit', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			const setId = ws.exerciseLogs[0].sets[0].id;

			const updated = updateSetLog(db, setId, { unit: 'lbs' });

			expect(updated!.unit).toBe('lbs');
		});

		it('partially updates (only weight)', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			const setId = ws.exerciseLogs[0].sets[0].id;

			updateSetLog(db, setId, { weight: 60, reps: 10 });
			const updated = updateSetLog(db, setId, { weight: 65 });

			expect(updated!.weight).toBe(65);
			expect(updated!.reps).toBe(10);
		});
	});

	describe('skipExercise / unskipExercise', () => {
		it('marks exercise as skipped', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			const skipped = skipExercise(db, ws.exerciseLogs[0].id);

			expect(skipped!.status).toBe('skipped');
		});

		it('reverts a skipped exercise', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			skipExercise(db, ws.exerciseLogs[0].id);
			const unskipped = unskipExercise(db, ws.exerciseLogs[0].id);

			expect(unskipped!.status).toBe('logged');
		});
	});

	describe('addAdhocExercise', () => {
		it('adds an ad-hoc exercise to the session', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);

			const log = addAdhocExercise(db, session.id, 'Lateral Raise');

			expect(log.exerciseName).toBe('Lateral Raise');
			expect(log.isAdhoc).toBe(true);
		});

		it('creates 3 default sets', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);

			const log = addAdhocExercise(db, session.id, 'Lateral Raise');
			const ws = getWorkoutSession(db, session.id)!;
			const adhocLog = ws.exerciseLogs.find((l) => l.id === log.id)!;

			expect(adhocLog.sets).toHaveLength(3);
		});

		it('auto-creates exercise in library if new', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);

			addAdhocExercise(db, session.id, 'New Exercise');

			const ex = db.select().from(exercises).where(eq(exercises.name, 'New Exercise')).get();
			expect(ex).toBeDefined();
		});

		it('does not duplicate existing exercise', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);

			addAdhocExercise(db, session.id, 'Bench Press');

			const all = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).all();
			expect(all).toHaveLength(1);
		});

		it('places ad-hoc exercise after existing exercises', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);
			const session = startWorkout(db, day.id);

			addAdhocExercise(db, session.id, 'Lateral Raise');
			const ws = getWorkoutSession(db, session.id)!;

			const adhocLog = ws.exerciseLogs.find((l) => l.exerciseName === 'Lateral Raise')!;
			expect(adhocLog.sortOrder).toBeGreaterThan(
				ws.exerciseLogs.find((l) => l.exerciseName === 'OHP')!.sortOrder
			);
		});
	});

	describe('addSetToExerciseLog', () => {
		it('adds a set with correct set number', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 3);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			const newSet = addSetToExerciseLog(db, ws.exerciseLogs[0].id);

			expect(newSet.setNumber).toBe(4);
			expect(newSet.weight).toBeNull();
			expect(newSet.reps).toBeNull();
		});

		it('uses exercise unit preference', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			db.update(exercises).set({ unitPreference: 'lbs' }).where(eq(exercises.id, ex.id)).run();

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			const newSet = addSetToExerciseLog(db, ws.exerciseLogs[0].id);
			expect(newSet.unit).toBe('lbs');
		});
	});

	describe('removeSetFromExerciseLog', () => {
		it('removes a set', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 3);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			const setToRemove = ws.exerciseLogs[0].sets[2];

			removeSetFromExerciseLog(db, setToRemove.id);

			const updated = getWorkoutSession(db, session.id)!;
			expect(updated.exerciseLogs[0].sets).toHaveLength(2);
		});
	});

	describe('completeWorkout', () => {
		it('marks session as completed', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			const completed = completeWorkout(db, session.id);

			expect('cancelled' in completed).toBe(false);
			if (!('cancelled' in completed)) {
				expect(completed.status).toBe('completed');
				expect(completed.completedAt).toBeDefined();
			}
		});

		it('marks unlogged exercises as skipped', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log sets for Bench Press only
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			completeWorkout(db, session.id);

			const updatedWs = getWorkoutSession(db, session.id)!;
			expect(updatedWs.exerciseLogs[0].status).toBe('logged');
			expect(updatedWs.exerciseLogs[1].status).toBe('skipped');
		});

		it('does not mark exercises with filled sets as skipped', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			completeWorkout(db, session.id);

			const updatedWs = getWorkoutSession(db, session.id)!;
			expect(updatedWs.exerciseLogs[0].status).toBe('logged');
		});

		it('cancels workout when no exercises have reps logged', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP']);
			const session = startWorkout(db, day.id);

			const result = completeWorkout(db, session.id);

			expect(result).toEqual({ cancelled: true });
			expect(getWorkoutSession(db, session.id)).toBeNull();
		});

		it('cancels workout when only weight is filled but no reps', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80 });

			const result = completeWorkout(db, session.id);

			expect(result).toEqual({ cancelled: true });
			expect(getWorkoutSession(db, session.id)).toBeNull();
		});

		it('completes workout when bodyweight exercise has reps but no weight', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Pull-ups']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { reps: 10 });

			const result = completeWorkout(db, session.id);

			expect('cancelled' in result).toBe(false);
			if (!('cancelled' in result)) {
				expect(result.status).toBe('completed');
			}
		});
	});

	describe('getWorkoutSummary', () => {
		it('returns null for non-existent session', () => {
			expect(getWorkoutSummary(db, 9999)).toBeNull();
		});

		it('returns correct completed vs total counts', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP', 'Flyes']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log Bench Press and OHP, skip Flyes
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			updateSetLog(db, ws.exerciseLogs[1].sets[0].id, { weight: 40, reps: 10 });
			completeWorkout(db, session.id);

			const summary = getWorkoutSummary(db, session.id)!;

			expect(summary.totalExercises).toBe(3);
			expect(summary.completedExercises).toBe(2);
			expect(summary.skippedExercises).toBe(1);
		});

		it('excludes ad-hoc exercises from total count', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			const adhocLog = addAdhocExercise(db, session.id, 'Lateral Raise');
			const adhocWs = getWorkoutSession(db, session.id)!;
			const adhocSets = adhocWs.exerciseLogs.find((l) => l.id === adhocLog.id)!.sets;
			updateSetLog(db, adhocSets[0].id, { weight: 10, reps: 15 });

			completeWorkout(db, session.id);

			const summary = getWorkoutSummary(db, session.id)!;
			expect(summary.totalExercises).toBe(1);
			expect(summary.completedExercises).toBe(1);
		});

		it('detects PRs', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// First workout - set a baseline
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			// Second workout - beat the baseline
			const session2 = startWorkout(db, day.id);
			const ws2 = getWorkoutSession(db, session2.id)!;
			updateSetLog(db, ws2.exerciseLogs[0].sets[0].id, { weight: 85, reps: 8 });
			completeWorkout(db, session2.id);

			const summary = getWorkoutSummary(db, session2.id)!;
			expect(summary.prs).toHaveLength(1);
			expect(summary.prs[0].exerciseName).toBe('Bench Press');
			expect(summary.prs[0].weight).toBe(85);
		});

		it('counts first workout as PR', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			completeWorkout(db, session.id);

			const summary = getWorkoutSummary(db, session.id)!;
			expect(summary.prs).toHaveLength(1);
			expect(summary.prs[0].weight).toBe(80);
		});

		it('does not count lower weight as PR', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			const session2 = startWorkout(db, day.id);
			const ws2 = getWorkoutSession(db, session2.id)!;
			updateSetLog(db, ws2.exerciseLogs[0].sets[0].id, { weight: 75, reps: 10 });
			completeWorkout(db, session2.id);

			const summary = getWorkoutSummary(db, session2.id)!;
			expect(summary.prs).toHaveLength(0);
		});
	});

	describe('getPreviousPerformance', () => {
		it('returns null when no history', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			expect(getPreviousPerformance(db, ex.id)).toBeNull();
		});

		it('returns the last completed session sets', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

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

			const prev = getPreviousPerformance(db, ex.id)!;

			expect(prev.sets).toHaveLength(3);
			expect(prev.sets[0].weight).toBe(60);
			expect(prev.sets[1].weight).toBe(70);
			expect(prev.sets[2].weight).toBe(80);
		});

		it('ignores skipped exercises', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// Complete one workout with data
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);

			// Start another and skip the exercise
			const session2 = startWorkout(db, day.id);
			const ws2 = getWorkoutSession(db, session2.id)!;
			skipExercise(db, ws2.exerciseLogs[0].id);
			completeWorkout(db, session2.id);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const prev = getPreviousPerformance(db, ex.id)!;
			expect(prev.sets[0].weight).toBe(60);
		});

		it('returns most recent completed session', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const prev = getPreviousPerformance(db, ex.id)!;
			expect(prev.sets[0].weight).toBe(70);
		});
	});

	describe('getMaxPerformance', () => {
		it('returns null when no history', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			expect(getMaxPerformance(db, ex.id)).toBeNull();
		});

		it('returns the heaviest weight ever', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 60, reps: 10 },
						{ weight: 80, reps: 5 }
					]
				}
			]);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 70, reps: 8 }] }
			]);

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const maxPerf = getMaxPerformance(db, ex.id)!;
			expect(maxPerf.weight).toBe(80);
			expect(maxPerf.reps).toBe(5);
		});

		it('ignores in-progress sessions', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 100, reps: 1 });
			// Don't complete

			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			expect(getMaxPerformance(db, ex.id)).toBeNull();
		});
	});

	describe('closeStaleWorkouts', () => {
		it('closes workouts older than 4 hours', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });

			// Manually set startedAt to 5 hours ago
			const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
			db.update(workoutSessions)
				.set({ startedAt: fiveHoursAgo })
				.where(eq(workoutSessions.id, session.id))
				.run();

			const closed = closeStaleWorkouts(db);

			expect(closed).toBe(1);
			const updated = db
				.select()
				.from(workoutSessions)
				.where(eq(workoutSessions.id, session.id))
				.get()!;
			expect(updated.status).toBe('completed');
		});

		it('does not close recent workouts', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			startWorkout(db, day.id);

			const closed = closeStaleWorkouts(db);

			expect(closed).toBe(0);
		});

		it('returns count of closed workouts', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const s1 = startWorkout(db, day.id);

			// Make it stale
			const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
			db.update(workoutSessions)
				.set({ startedAt: fiveHoursAgo })
				.where(eq(workoutSessions.id, s1.id))
				.run();

			// Start another (now that the first is stale, startWorkout still sees it as in_progress)
			// Actually, we need to complete the first one before starting another
			// So let's test with just one
			const closed = closeStaleWorkouts(db);
			expect(closed).toBe(1);
		});
	});

	describe('updateExerciseUnitPreference', () => {
		it('updates the unit preference', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			const updated = updateExerciseUnitPreference(db, ex.id, 'lbs');

			expect(updated!.unitPreference).toBe('lbs');
		});

		it('persists the preference', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			updateExerciseUnitPreference(db, ex.id, 'lbs');

			const fetched = db.select().from(exercises).where(eq(exercises.id, ex.id)).get()!;
			expect(fetched.unitPreference).toBe('lbs');
		});
	});
});
