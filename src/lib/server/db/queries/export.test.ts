import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import { exportAsJSON, exportAsCSV } from './export';
import { createProgram, addWorkoutDay, addDayExercise, setActiveProgram } from './programs';
import { exercises, workoutSessions, exerciseLogs, setLogs } from '../schema';
import { eq } from 'drizzle-orm';

describe('export queries', () => {
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
		programName?: string;
		dayName?: string;
		sessionStatus?: 'in_progress' | 'completed';
		exerciseStatus?: 'logged' | 'skipped';
		sets: Array<{ weight: number | null; reps: number | null; unit?: 'kg' | 'lbs' }>;
		sessionDate: Date;
		sortOrder?: number;
	}) {
		const session = db
			.insert(workoutSessions)
			.values({
				programName: opts.programName ?? 'Test',
				dayName: opts.dayName ?? 'Day 1',
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
				sortOrder: opts.sortOrder ?? 0
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

	describe('exportAsJSON', () => {
		it('returns correct structure with empty database', () => {
			const result = exportAsJSON(db);

			expect(result.version).toBe('1.0');
			expect(result.exportedAt).toBeDefined();
			expect(typeof result.exportedAt).toBe('string');
			// exportedAt should be a valid ISO timestamp
			expect(() => new Date(result.exportedAt)).not.toThrow();
			expect(result.programs).toEqual([]);
			expect(result.exercises).toEqual([]);
		});

		it('includes all programs with days and exercises', () => {
			const p = createProgram(db, 'Push Pull');
			const day1 = addWorkoutDay(db, p.id, 'Push');
			const day2 = addWorkoutDay(db, p.id, 'Pull');
			addDayExercise(db, day1.id, 'Bench Press');
			addDayExercise(db, day1.id, 'Overhead Press');
			addDayExercise(db, day2.id, 'Barbell Row');

			const result = exportAsJSON(db);

			// Find the 'Push Pull' program (ignore __setup programs from createExercise)
			const program = result.programs.find((p) => p.name === 'Push Pull');
			expect(program).toBeDefined();
			expect(program!.days).toHaveLength(2);

			const pushDay = program!.days.find((d) => d.name === 'Push');
			expect(pushDay).toBeDefined();
			expect(pushDay!.exercises).toHaveLength(2);
			expect(pushDay!.exercises.map((e) => e.name)).toContain('Bench Press');
			expect(pushDay!.exercises.map((e) => e.name)).toContain('Overhead Press');

			const pullDay = program!.days.find((d) => d.name === 'Pull');
			expect(pullDay).toBeDefined();
			expect(pullDay!.exercises).toHaveLength(1);
			expect(pullDay!.exercises[0].name).toBe('Barbell Row');
		});

		it('includes progressive overload data for exercises with history', () => {
			const p = createProgram(db, 'Strength');
			const day = addWorkoutDay(db, p.id, 'Day A');
			addDayExercise(db, day.id, 'Squat');
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Squat')).get()!;

			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Squat',
				sets: [
					{ weight: 100, reps: 5 },
					{ weight: 120, reps: 3 }
				],
				sessionDate: new Date('2024-03-10')
			});
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Squat',
				sets: [{ weight: 110, reps: 5 }],
				sessionDate: new Date('2024-03-15')
			});

			const result = exportAsJSON(db);

			const program = result.programs.find((p) => p.name === 'Strength');
			const dayA = program!.days.find((d) => d.name === 'Day A');
			const squat = dayA!.exercises.find((e) => e.name === 'Squat');

			expect(squat!.maxWeight).not.toBeNull();
			expect(squat!.maxWeight!.weight).toBe(120);
			expect(squat!.maxWeight!.reps).toBe(3);
			expect(squat!.maxWeight!.unit).toBe('kg');

			expect(squat!.lastPerformed).not.toBeNull();
			expect(squat!.lastPerformed!.date).toBeDefined();
		});

		it('returns null for progressive overload when exercise has no history', () => {
			const p = createProgram(db, 'New Program');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			addDayExercise(db, day.id, 'Deadlift');

			const result = exportAsJSON(db);

			const program = result.programs.find((p) => p.name === 'New Program');
			const day1 = program!.days[0];
			const deadlift = day1.exercises.find((e) => e.name === 'Deadlift');

			expect(deadlift!.lastPerformed).toBeNull();
			expect(deadlift!.maxWeight).toBeNull();
		});

		it('includes all exercises in the exercise library', () => {
			createExercise('Bench Press');
			createExercise('Squat');
			createExercise('Deadlift');

			const result = exportAsJSON(db);

			expect(result.exercises.length).toBeGreaterThanOrEqual(3);
			const names = result.exercises.map((e) => e.name);
			expect(names).toContain('Bench Press');
			expect(names).toContain('Squat');
			expect(names).toContain('Deadlift');

			// Each exercise should have id, name, and unitPreference
			for (const ex of result.exercises) {
				expect(ex.id).toBeDefined();
				expect(ex.name).toBeDefined();
				expect(ex.unitPreference).toBeDefined();
			}
		});

		it('handles inactive programs correctly', () => {
			const p1 = createProgram(db, 'Active Program');
			setActiveProgram(db, p1.id);
			const p2 = createProgram(db, 'Inactive Program');
			addWorkoutDay(db, p1.id, 'Day 1');
			addWorkoutDay(db, p2.id, 'Day 1');

			const result = exportAsJSON(db);

			const activeProgram = result.programs.find((p) => p.name === 'Active Program');
			const inactiveProgram = result.programs.find((p) => p.name === 'Inactive Program');

			expect(activeProgram).toBeDefined();
			expect(activeProgram!.isActive).toBe(true);

			expect(inactiveProgram).toBeDefined();
			expect(inactiveProgram!.isActive).toBe(false);
		});
	});

	describe('exportAsCSV', () => {
		it('returns only header row when no completed sessions exist', () => {
			const csv = exportAsCSV(db);
			const lines = csv.trim().split('\n');

			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain('session_date');
		});

		it('returns correct CSV header', () => {
			const csv = exportAsCSV(db);
			const header = csv.trim().split('\n')[0];

			expect(header).toBe(
				'session_date,session_id,program_name,day_name,' +
					'exercise_name,exercise_status,set_number,weight,reps,unit'
			);
		});

		it('returns correct data rows for logged exercises with sets', () => {
			const ex = createExercise('Bench Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Bench Press',
				programName: 'Upper Lower',
				dayName: 'Upper',
				sets: [
					{ weight: 80, reps: 8, unit: 'kg' },
					{ weight: 80, reps: 7, unit: 'kg' },
					{ weight: 80, reps: 6, unit: 'kg' }
				],
				sessionDate: new Date('2024-01-15')
			});

			const csv = exportAsCSV(db);
			const lines = csv.trim().split('\n');

			// Header + 3 set rows
			expect(lines).toHaveLength(4);

			// Check first data row
			const row1 = lines[1].split(',');
			expect(row1[0]).toBe('2024-01-15'); // session_date
			expect(row1[2]).toBe('Upper Lower'); // program_name
			expect(row1[3]).toBe('Upper'); // day_name
			expect(row1[4]).toBe('Bench Press'); // exercise_name
			expect(row1[5]).toBe('logged'); // exercise_status
			expect(row1[6]).toBe('1'); // set_number
			expect(row1[7]).toBe('80'); // weight
			expect(row1[8]).toBe('8'); // reps
			expect(row1[9]).toBe('kg'); // unit

			// Check subsequent sets have incrementing set numbers
			expect(lines[2].split(',')[6]).toBe('2');
			expect(lines[3].split(',')[6]).toBe('3');
		});

		it('handles skipped exercises with empty set fields', () => {
			const ex = createExercise('Overhead Press');
			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Overhead Press',
				programName: 'Push Pull',
				dayName: 'Push',
				exerciseStatus: 'skipped',
				sets: [],
				sessionDate: new Date('2024-02-01')
			});

			const csv = exportAsCSV(db);
			const lines = csv.trim().split('\n');

			// Header + 1 row for the skipped exercise
			expect(lines).toHaveLength(2);

			const row = lines[1].split(',');
			expect(row[4]).toBe('Overhead Press');
			expect(row[5]).toBe('skipped');
			// set_number, weight, reps should be empty for skipped
			expect(row[6]).toBe('');
			expect(row[7]).toBe('');
			expect(row[8]).toBe('');
		});

		it('orders rows by session date descending then exercise sort order', () => {
			const bench = createExercise('Bench Press');
			const squat = createExercise('Squat');

			// Older session
			const { session: s1 } = insertHistory({
				exerciseId: bench.id,
				exerciseName: 'Bench Press',
				programName: 'PPL',
				dayName: 'Push',
				sets: [{ weight: 60, reps: 10 }],
				sessionDate: new Date('2024-01-10'),
				sortOrder: 0
			});
			// Insert second exercise in same session
			const log2 = db
				.insert(exerciseLogs)
				.values({
					exerciseId: squat.id,
					sessionId: s1.id,
					exerciseName: 'Squat',
					status: 'logged',
					isAdhoc: false,
					sortOrder: 1
				})
				.returning()
				.get();
			db.insert(setLogs)
				.values({
					exerciseLogId: log2.id,
					setNumber: 1,
					weight: 100,
					reps: 5,
					unit: 'kg'
				})
				.run();

			// Newer session
			insertHistory({
				exerciseId: bench.id,
				exerciseName: 'Bench Press',
				programName: 'PPL',
				dayName: 'Push',
				sets: [{ weight: 70, reps: 8 }],
				sessionDate: new Date('2024-02-10'),
				sortOrder: 0
			});

			const csv = exportAsCSV(db);
			const lines = csv.trim().split('\n');
			const dataLines = lines.slice(1);

			// Newer session should come first
			expect(dataLines[0].split(',')[0]).toBe('2024-02-10');

			// Older session rows after
			const olderRows = dataLines.filter((l) => l.split(',')[0] === '2024-01-10');
			expect(olderRows).toHaveLength(2);
			// Bench Press (sortOrder 0) should come before Squat (sortOrder 1)
			expect(olderRows[0].split(',')[4]).toBe('Bench Press');
			expect(olderRows[1].split(',')[4]).toBe('Squat');
		});

		it('handles multiple sessions correctly', () => {
			const ex = createExercise('Deadlift');

			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Deadlift',
				programName: 'Strength',
				dayName: 'Day A',
				sets: [
					{ weight: 140, reps: 5 },
					{ weight: 140, reps: 4 }
				],
				sessionDate: new Date('2024-03-01')
			});

			insertHistory({
				exerciseId: ex.id,
				exerciseName: 'Deadlift',
				programName: 'Strength',
				dayName: 'Day A',
				sets: [{ weight: 150, reps: 3 }],
				sessionDate: new Date('2024-03-08')
			});

			const csv = exportAsCSV(db);
			const lines = csv.trim().split('\n');
			const dataLines = lines.slice(1);

			// 2 sets from first session + 1 set from second session = 3 data rows
			expect(dataLines).toHaveLength(3);

			// Both session IDs should appear
			const sessionIds = new Set(dataLines.map((l) => l.split(',')[1]));
			expect(sessionIds.size).toBe(2);
		});
	});
});
