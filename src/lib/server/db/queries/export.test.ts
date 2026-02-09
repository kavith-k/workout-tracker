import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import { exportAsJSON, exportAsCSV } from './export';
import {
	startWorkout,
	getWorkoutSession,
	updateSetLog,
	completeWorkout,
	skipExercise
} from './workouts';
import { createProgram, addWorkoutDay, addDayExercise, setActiveProgram } from './programs';
import { exercises } from '../schema';
import { eq } from 'drizzle-orm';

describe('export queries', () => {
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

	describe('exportAsJSON', () => {
		it('returns valid structure with empty arrays when database is empty', () => {
			const result = exportAsJSON(db);

			expect(result.version).toBe('1.0');
			expect(result.exportedAt).toBeDefined();
			expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt);
			expect(result.programs).toEqual([]);
			expect(result.exercises).toEqual([]);
		});

		it('returns exportedAt as a valid ISO string and version as 1.0', () => {
			const before = new Date().toISOString();
			const result = exportAsJSON(db);
			const after = new Date().toISOString();

			expect(result.version).toBe('1.0');
			expect(result.exportedAt >= before).toBe(true);
			expect(result.exportedAt <= after).toBe(true);
		});

		it('includes programs with days and exercises correctly structured', () => {
			const { program, day } = setupProgramWithDay('PPL', 'Push', [
				'Bench Press',
				'Overhead Press'
			]);

			const result = exportAsJSON(db);

			expect(result.programs).toHaveLength(1);
			const p = result.programs[0];
			expect(p.id).toBe(program.id);
			expect(p.name).toBe('PPL');
			expect(p.isActive).toBe(true);
			expect(p.days).toHaveLength(1);

			const d = p.days[0];
			expect(d.id).toBe(day.id);
			expect(d.name).toBe('Push');
			expect(d.sortOrder).toBe(0);
			expect(d.exercises).toHaveLength(2);

			expect(d.exercises[0].name).toBe('Bench Press');
			expect(d.exercises[0].setsCount).toBe(3);
			expect(d.exercises[0].sortOrder).toBe(0);
			expect(d.exercises[1].name).toBe('Overhead Press');
			expect(d.exercises[1].sortOrder).toBe(1);
		});

		it('represents active and inactive programs correctly', () => {
			setupProgramWithDay('Active Plan', 'Day 1', ['Squats']);
			createProgram(db, 'Inactive Plan');

			const result = exportAsJSON(db);

			expect(result.programs).toHaveLength(2);
			const active = result.programs.find((p) => p.name === 'Active Plan');
			const inactive = result.programs.find((p) => p.name === 'Inactive Plan');
			expect(active!.isActive).toBe(true);
			expect(inactive!.isActive).toBe(false);
		});

		it('populates lastPerformed and maxWeight when workout history exists', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 2);

			// First workout: lighter weight
			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 60, reps: 10 },
						{ weight: 60, reps: 8 }
					]
				}
			]);

			// Second workout: heavier weight
			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 80, reps: 6 },
						{ weight: 70, reps: 8 }
					]
				}
			]);

			const result = exportAsJSON(db);
			const exercise = result.programs[0].days[0].exercises[0];

			// lastPerformed should be from the most recent session
			expect(exercise.lastPerformed).not.toBeNull();
			expect(exercise.lastPerformed!.weight).toBe(80);
			expect(exercise.lastPerformed!.reps).toBe(6);
			expect(exercise.lastPerformed!.unit).toBe('kg');
			expect(exercise.lastPerformed!.date).toBeDefined();

			// maxWeight should be the heaviest across all sessions
			expect(exercise.maxWeight).not.toBeNull();
			expect(exercise.maxWeight!.weight).toBe(80);
			expect(exercise.maxWeight!.reps).toBe(6);
			expect(exercise.maxWeight!.unit).toBe('kg');
		});

		it('returns null for lastPerformed and maxWeight when no workout history', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			const result = exportAsJSON(db);
			const exercise = result.programs[0].days[0].exercises[0];

			expect(exercise.lastPerformed).toBeNull();
			expect(exercise.maxWeight).toBeNull();
		});

		it('includes all exercises in the exercise library', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press', 'Overhead Press']);
			setupProgramWithDay('PPL2', 'Legs', ['Squats']);

			const result = exportAsJSON(db);

			expect(result.exercises).toHaveLength(3);
			const names = result.exercises.map((e) => e.name).sort();
			expect(names).toEqual(['Bench Press', 'Overhead Press', 'Squats']);
		});

		it('includes unitPreference for each exercise in the library', () => {
			setupProgramWithDay('PPL', 'Push', ['Bench Press']);

			// Change unit preference for the exercise
			const ex = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
			db.update(exercises).set({ unitPreference: 'lbs' }).where(eq(exercises.id, ex.id)).run();

			const result = exportAsJSON(db);

			const benchExport = result.exercises.find((e) => e.name === 'Bench Press');
			expect(benchExport).toBeDefined();
			expect(benchExport!.unitPreference).toBe('lbs');
		});

		it('orders programs by name alphabetically', () => {
			createProgram(db, 'Zebra Plan');
			createProgram(db, 'Alpha Plan');
			createProgram(db, 'Middle Plan');

			const result = exportAsJSON(db);

			expect(result.programs.map((p) => p.name)).toEqual([
				'Alpha Plan',
				'Middle Plan',
				'Zebra Plan'
			]);
		});

		it('includes multiple days per program in sortOrder', () => {
			const program = createProgram(db, 'PPL');
			setActiveProgram(db, program.id);
			const day1 = addWorkoutDay(db, program.id, 'Push');
			const day2 = addWorkoutDay(db, program.id, 'Pull');
			const day3 = addWorkoutDay(db, program.id, 'Legs');
			addDayExercise(db, day1.id, 'Bench Press');
			addDayExercise(db, day2.id, 'Rows');
			addDayExercise(db, day3.id, 'Squats');

			const result = exportAsJSON(db);

			expect(result.programs[0].days).toHaveLength(3);
			expect(result.programs[0].days[0].name).toBe('Push');
			expect(result.programs[0].days[0].sortOrder).toBe(0);
			expect(result.programs[0].days[1].name).toBe('Pull');
			expect(result.programs[0].days[1].sortOrder).toBe(1);
			expect(result.programs[0].days[2].name).toBe('Legs');
			expect(result.programs[0].days[2].sortOrder).toBe(2);
		});
	});

	describe('exportAsCSV', () => {
		const header =
			'session_date,session_id,program_name,day_name,exercise_name,exercise_status,set_number,weight,reps,unit';

		it('returns only the header line when database is empty', () => {
			const result = exportAsCSV(db);

			expect(result).toBe(header);
		});

		it('produces correct rows for sessions with exercises and sets', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 2);

			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 80, reps: 8 },
						{ weight: 85, reps: 6 }
					]
				}
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			expect(lines).toHaveLength(3); // header + 2 sets
			expect(lines[0]).toBe(header);

			// Each row should contain program name, day name, exercise name, logged status
			expect(lines[1]).toContain('PPL');
			expect(lines[1]).toContain('Push');
			expect(lines[1]).toContain('Bench Press');
			expect(lines[1]).toContain('logged');
			expect(lines[1]).toContain('80');
			expect(lines[1]).toContain('8');
			expect(lines[1]).toContain('kg');

			expect(lines[2]).toContain('85');
			expect(lines[2]).toContain('6');
		});

		it('produces a single row with empty set fields for skipped exercises', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP'], 2);

			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log Bench Press, skip OHP
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80, reps: 8 });
			updateSetLog(db, ws.exerciseLogs[0].sets[1].id, { weight: 85, reps: 6 });
			skipExercise(db, ws.exerciseLogs[1].id);
			completeWorkout(db, session.id);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			// header + 2 logged sets + 1 skipped row
			expect(lines).toHaveLength(4);

			// The skipped row should have empty set_number, weight, reps, unit
			const skippedLine = lines[3];
			expect(skippedLine).toContain('OHP');
			expect(skippedLine).toContain('skipped');
			// Skipped row ends with empty fields: ,skipped,,,,
			const parts = skippedLine.split(',');
			expect(parts[5]).toBe('skipped');
			expect(parts[6]).toBe(''); // set_number
			expect(parts[7]).toBe(''); // weight
			expect(parts[8]).toBe(''); // reps
			expect(parts[9]).toBe(''); // unit
		});

		it('shows null weights and reps as empty strings', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 2);

			// Start workout and only fill weight (not reps) on one set, leave another empty
			const session = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, session.id)!;

			// Log just weight without reps on set 1
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 80 });
			completeWorkout(db, session.id);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			// Only set 1 should appear (set 2 has null weight, and the exercise won't be
			// skipped because set 1 has a weight)
			const dataLines = lines.slice(1);
			// Set 1 has weight=80 but reps=null
			const set1Parts = dataLines[0].split(',');
			expect(set1Parts[7]).toBe('80'); // weight
			expect(set1Parts[8]).toBe(''); // reps is null -> empty string
		});

		it('escapes CSV values that contain commas', () => {
			const program = createProgram(db, 'Push, Pull, Legs');
			setActiveProgram(db, program.id);
			const day = addWorkoutDay(db, program.id, 'Push, Day 1');
			addDayExercise(db, day.id, 'Bench Press', 1);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			// The program name and day name should be quoted
			expect(lines[1]).toContain('"Push, Pull, Legs"');
			expect(lines[1]).toContain('"Push, Day 1"');
		});

		it('only includes completed sessions, not in-progress ones', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 1);

			// Complete one session
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			// Start but do not complete another
			const inProgress = startWorkout(db, day.id);
			const ws = getWorkoutSession(db, inProgress.id)!;
			updateSetLog(db, ws.exerciseLogs[0].sets[0].id, { weight: 90, reps: 5 });

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			// header + 1 set from the completed session only
			expect(lines).toHaveLength(2);
			expect(result).not.toContain('90');
		});

		it('orders sessions by completedAt ascending', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 1);

			// Complete two sessions — they get sequential completedAt timestamps
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 60, reps: 10 }] }
			]);
			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			expect(lines).toHaveLength(3); // header + 2 rows

			// First data row should have the earlier session (lighter weight)
			const firstDataParts = lines[1].split(',');
			const secondDataParts = lines[2].split(',');
			expect(Number(firstDataParts[7])).toBe(60);
			expect(Number(secondDataParts[7])).toBe(80);

			// Session IDs should be ascending
			expect(Number(firstDataParts[1])).toBeLessThan(Number(secondDataParts[1]));
		});

		it('handles multiple exercises per session', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press', 'OHP'], 1);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] },
				{ exerciseName: 'OHP', sets: [{ weight: 40, reps: 10 }] }
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			expect(lines).toHaveLength(3); // header + 2 exercise rows
			expect(lines[1]).toContain('Bench Press');
			expect(lines[2]).toContain('OHP');
		});

		it('handles multiple sessions across different days', () => {
			const program = createProgram(db, 'PPL');
			setActiveProgram(db, program.id);
			const pushDay = addWorkoutDay(db, program.id, 'Push');
			const pullDay = addWorkoutDay(db, program.id, 'Pull');
			addDayExercise(db, pushDay.id, 'Bench Press', 1);
			addDayExercise(db, pullDay.id, 'Barbell Row', 1);

			completeWorkoutWithSets(pushDay.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);
			completeWorkoutWithSets(pullDay.id, [
				{ exerciseName: 'Barbell Row', sets: [{ weight: 70, reps: 10 }] }
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			expect(lines).toHaveLength(3); // header + 2 rows
			expect(lines[1]).toContain('Push');
			expect(lines[1]).toContain('Bench Press');
			expect(lines[2]).toContain('Pull');
			expect(lines[2]).toContain('Barbell Row');
		});

		it('escapes CSV values that contain double quotes', () => {
			const program = createProgram(db, 'Plan "A"');
			setActiveProgram(db, program.id);
			const day = addWorkoutDay(db, program.id, 'Day 1');
			addDayExercise(db, day.id, 'Bench Press', 1);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			const result = exportAsCSV(db);

			// Double quotes in CSV should be escaped as ""
			expect(result).toContain('"Plan ""A"""');
		});

		it('includes correct set_number values', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 3);

			completeWorkoutWithSets(day.id, [
				{
					exerciseName: 'Bench Press',
					sets: [
						{ weight: 80, reps: 8 },
						{ weight: 85, reps: 6 },
						{ weight: 90, reps: 4 }
					]
				}
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');

			expect(lines).toHaveLength(4); // header + 3 sets

			const set1Parts = lines[1].split(',');
			const set2Parts = lines[2].split(',');
			const set3Parts = lines[3].split(',');

			expect(set1Parts[6]).toBe('1');
			expect(set2Parts[6]).toBe('2');
			expect(set3Parts[6]).toBe('3');
		});

		it('uses session date in YYYY-MM-DD format', () => {
			const { day } = setupProgramWithDay('PPL', 'Push', ['Bench Press'], 1);

			completeWorkoutWithSets(day.id, [
				{ exerciseName: 'Bench Press', sets: [{ weight: 80, reps: 8 }] }
			]);

			const result = exportAsCSV(db);
			const lines = result.split('\n');
			const datePart = lines[1].split(',')[0];

			// Should be YYYY-MM-DD format
			expect(datePart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});
});
