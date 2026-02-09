import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import { getAllExercises, renameExercise, deleteExercise, getExerciseStats } from './exercises';
import { addDayExercise, addWorkoutDay, createProgram } from './programs';
import { exercises, workoutSessions, exerciseLogs, setLogs, dayExercises } from '../schema';
import { eq } from 'drizzle-orm';

describe('exercises queries', () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	/** Helper to create an exercise in the library via the programs flow. */
	function createExercise(name: string) {
		const p = createProgram(db, '__setup');
		const day = addWorkoutDay(db, p.id, 'Day');
		addDayExercise(db, day.id, name);
		return db.select().from(exercises).where(eq(exercises.name, name)).get()!;
	}

	/** Helper to insert a completed session with a logged exercise and sets. */
	function insertHistory(opts: {
		exerciseId: number;
		exerciseName: string;
		sessionStatus?: 'in_progress' | 'completed';
		exerciseStatus?: 'logged' | 'skipped';
		sets: Array<{ weight: number | null; reps: number | null; unit?: 'kg' | 'lbs' }>;
		sessionDate: Date;
	}) {
		const session = db
			.insert(workoutSessions)
			.values({
				programName: 'Test',
				dayName: 'Day 1',
				status: opts.sessionStatus ?? 'completed',
				startedAt: opts.sessionDate,
				completedAt: opts.sessionStatus === 'in_progress' ? undefined : opts.sessionDate
			})
			.returning()
			.get();

		const log = db
			.insert(exerciseLogs)
			.values({
				exerciseId: opts.exerciseId,
				sessionId: session.id,
				exerciseName: opts.exerciseName,
				status: opts.exerciseStatus ?? 'logged',
				isAdhoc: false,
				sortOrder: 0
			})
			.returning()
			.get();

		for (let i = 0; i < opts.sets.length; i++) {
			db.insert(setLogs)
				.values({
					exerciseLogId: log.id,
					setNumber: i + 1,
					weight: opts.sets[i].weight,
					reps: opts.sets[i].reps,
					unit: opts.sets[i].unit ?? 'kg'
				})
				.run();
		}

		return { session, log };
	}

	describe('getAllExercises', () => {
		it('returns empty array when no exercises exist', () => {
			const result = getAllExercises(db);

			expect(result).toEqual([]);
		});

		it('returns exercises ordered alphabetically', () => {
			createExercise('Squat');
			createExercise('Bench Press');
			createExercise('Deadlift');

			const result = getAllExercises(db);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe('Bench Press');
			expect(result[1].name).toBe('Deadlift');
			expect(result[2].name).toBe('Squat');
		});

		it('includes stats from completed sessions', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sets: [
					{ weight: 60, reps: 10 },
					{ weight: 80, reps: 5 }
				],
				sessionDate: new Date('2024-03-10')
			});

			const result = getAllExercises(db);

			expect(result).toHaveLength(1);
			expect(result[0].maxWeight).not.toBeNull();
			expect(result[0].maxWeight!.weight).toBe(80);
			expect(result[0].maxWeight!.reps).toBe(5);
			expect(result[0].maxWeight!.unit).toBe('kg');
			expect(result[0].lastPerformed).toEqual(new Date('2024-03-10'));
		});

		it('excludes stats from skipped exercises', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				exerciseStatus: 'skipped',
				sets: [{ weight: 100, reps: 5 }],
				sessionDate: new Date('2024-03-10')
			});

			const result = getAllExercises(db);

			expect(result).toHaveLength(1);
			expect(result[0].maxWeight).toBeNull();
			expect(result[0].lastPerformed).toBeNull();
		});

		it('excludes stats from in-progress sessions', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sessionStatus: 'in_progress',
				sets: [{ weight: 100, reps: 5 }],
				sessionDate: new Date('2024-03-10')
			});

			const result = getAllExercises(db);

			expect(result).toHaveLength(1);
			expect(result[0].maxWeight).toBeNull();
			expect(result[0].lastPerformed).toBeNull();
		});
	});

	describe('renameExercise', () => {
		it('updates name successfully', () => {
			const ex = createExercise('Old Name');

			const updated = renameExercise(db, ex.id, 'New Name');

			expect(updated).toBeDefined();
			expect(updated!.id).toBe(ex.id);
			expect(updated!.name).toBe('New Name');
		});

		it('fails on duplicate name', () => {
			createExercise('Bench Press');
			const ex2 = createExercise('Squat');

			expect(() => renameExercise(db, ex2.id, 'Bench Press')).toThrow();
		});
	});

	describe('deleteExercise', () => {
		it('removes exercise from library', () => {
			const ex = createExercise('Bench Press');

			deleteExercise(db, ex.id);

			const all = db.select().from(exercises).all();
			expect(all.find((e) => e.id === ex.id)).toBeUndefined();
		});

		it('reports hadHistory=false when no history', () => {
			const ex = createExercise('Bench Press');

			const result = deleteExercise(db, ex.id);

			expect(result.deleted).toBe(true);
			expect(result.hadHistory).toBe(false);
		});

		it('reports hadHistory=true when has history', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sets: [{ weight: 60, reps: 10 }],
				sessionDate: new Date('2024-01-15')
			});

			const result = deleteExercise(db, ex.id);

			expect(result.deleted).toBe(true);
			expect(result.hadHistory).toBe(true);
		});

		it('preserves historical exercise logs with FK set to null', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sets: [{ weight: 60, reps: 10 }],
				sessionDate: new Date('2024-01-15')
			});

			deleteExercise(db, ex.id);

			const logs = db.select().from(exerciseLogs).all();
			expect(logs).toHaveLength(1);
			expect(logs[0].exerciseName).toBe('Bench Press');
			expect(logs[0].exerciseId).toBeNull();
		});

		it('removes exercise from day_exercises', () => {
			const p = createProgram(db, 'Test Program');
			const day = addWorkoutDay(db, p.id, 'Push');
			addDayExercise(db, day.id, 'Bench Press');
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;

			deleteExercise(db, ex.id);

			const remaining = db.select().from(dayExercises).all();
			expect(remaining.find((de) => de.exerciseId === ex.id)).toBeUndefined();
		});
	});

	describe('getExerciseStats', () => {
		it('returns null stats when no history', () => {
			const ex = createExercise('Bench Press');

			const stats = getExerciseStats(db, ex.id);

			expect(stats.maxWeight).toBeNull();
			expect(stats.lastPerformed).toBeNull();
		});

		it('returns correct max weight', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sets: [
					{ weight: 60, reps: 10, unit: 'kg' },
					{ weight: 80, reps: 5, unit: 'kg' }
				],
				sessionDate: new Date('2024-01-10')
			});
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				sets: [{ weight: 70, reps: 8, unit: 'kg' }],
				sessionDate: new Date('2024-02-10')
			});

			const stats = getExerciseStats(db, ex.id);

			expect(stats.maxWeight).not.toBeNull();
			expect(stats.maxWeight!.weight).toBe(80);
			expect(stats.maxWeight!.reps).toBe(5);
			expect(stats.maxWeight!.unit).toBe('kg');
		});

		it('returns correct last performed date', () => {
			const ex = createExercise('Squat');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Squat',
				sets: [{ weight: 100, reps: 5 }],
				sessionDate: new Date('2024-01-10')
			});
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Squat',
				sets: [{ weight: 110, reps: 3 }],
				sessionDate: new Date('2024-03-20')
			});

			const stats = getExerciseStats(db, ex.id);

			expect(stats.lastPerformed).toEqual(new Date('2024-03-20'));
		});
	});
});
