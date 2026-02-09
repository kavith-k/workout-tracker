import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helper';
import {
	createProgram,
	getProgram,
	getAllPrograms,
	updateProgram,
	deleteProgram,
	duplicateProgram,
	setActiveProgram,
	getActiveProgram,
	addWorkoutDay,
	removeWorkoutDay,
	renameWorkoutDay,
	reorderWorkoutDays,
	addDayExercise,
	removeDayExercise,
	updateDayExerciseSets,
	reorderDayExercises
} from './programs';
import { exercises } from '../schema';

describe('programs queries', () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	describe('createProgram', () => {
		it('creates and returns a program', () => {
			const program = createProgram(db, 'Push Pull Legs');

			expect(program).toBeDefined();
			expect(program.id).toBe(1);
			expect(program.name).toBe('Push Pull Legs');
			expect(program.isActive).toBe(false);
			expect(program.createdAt).toBeInstanceOf(Date);
			expect(program.updatedAt).toBeInstanceOf(Date);
		});

		it('creates multiple programs with unique ids', () => {
			const p1 = createProgram(db, 'Program A');
			const p2 = createProgram(db, 'Program B');

			expect(p1.id).not.toBe(p2.id);
			expect(p1.name).toBe('Program A');
			expect(p2.name).toBe('Program B');
		});
	});

	describe('getAllPrograms', () => {
		it('returns empty array when no programs exist', () => {
			const result = getAllPrograms(db);

			expect(result).toEqual([]);
		});

		it('returns all programs ordered by name', () => {
			createProgram(db, 'Zzz Program');
			createProgram(db, 'Aaa Program');
			createProgram(db, 'Mmm Program');

			const result = getAllPrograms(db);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe('Aaa Program');
			expect(result[1].name).toBe('Mmm Program');
			expect(result[2].name).toBe('Zzz Program');
		});

		it('includes isActive flag', () => {
			const p = createProgram(db, 'Test');
			setActiveProgram(db, p.id);

			const result = getAllPrograms(db);

			expect(result[0].isActive).toBe(true);
		});
	});

	describe('getProgram', () => {
		it('returns null for non-existent id', () => {
			const result = getProgram(db, 999);

			expect(result).toBeNull();
		});

		it('returns program with empty days when no days exist', () => {
			const p = createProgram(db, 'Empty Program');
			const result = getProgram(db, p.id);

			expect(result).not.toBeNull();
			expect(result!.name).toBe('Empty Program');
			expect(result!.days).toEqual([]);
		});

		it('returns program with days and exercises nested', () => {
			const p = createProgram(db, 'Full Program');
			const day = addWorkoutDay(db, p.id, 'Push Day');
			addDayExercise(db, day.id, 'Bench Press', 4);
			addDayExercise(db, day.id, 'Overhead Press', 3);

			const result = getProgram(db, p.id);

			expect(result).not.toBeNull();
			expect(result!.days).toHaveLength(1);
			expect(result!.days[0].name).toBe('Push Day');
			expect(result!.days[0].exercises).toHaveLength(2);
			expect(result!.days[0].exercises[0].exerciseName).toBe('Bench Press');
			expect(result!.days[0].exercises[0].setsCount).toBe(4);
			expect(result!.days[0].exercises[1].exerciseName).toBe('Overhead Press');
			expect(result!.days[0].exercises[1].setsCount).toBe(3);
		});

		it('returns days ordered by sortOrder', () => {
			const p = createProgram(db, 'Multi Day');
			addWorkoutDay(db, p.id, 'Day A');
			addWorkoutDay(db, p.id, 'Day B');
			addWorkoutDay(db, p.id, 'Day C');

			const result = getProgram(db, p.id);

			expect(result!.days).toHaveLength(3);
			expect(result!.days[0].name).toBe('Day A');
			expect(result!.days[1].name).toBe('Day B');
			expect(result!.days[2].name).toBe('Day C');
		});
	});

	describe('updateProgram', () => {
		it('updates name and updatedAt', () => {
			const p = createProgram(db, 'Old Name');
			const originalUpdatedAt = p.updatedAt;

			// Small delay to ensure different timestamp
			const updated = updateProgram(db, p.id, { name: 'New Name' });

			expect(updated).toBeDefined();
			expect(updated!.name).toBe('New Name');
			expect(updated!.updatedAt).toBeInstanceOf(Date);
			expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
		});

		it('preserves other fields when updating name', () => {
			const p = createProgram(db, 'Test');
			const updated = updateProgram(db, p.id, { name: 'Updated' });

			expect(updated!.id).toBe(p.id);
			expect(updated!.isActive).toBe(p.isActive);
			expect(updated!.createdAt.getTime()).toBe(p.createdAt.getTime());
		});
	});

	describe('deleteProgram', () => {
		it('removes the program', () => {
			const p = createProgram(db, 'To Delete');
			deleteProgram(db, p.id);

			const result = getProgram(db, p.id);
			expect(result).toBeNull();
		});

		it('cascades to days and day exercises', () => {
			const p = createProgram(db, 'Cascade Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			addDayExercise(db, day.id, 'Squat');

			deleteProgram(db, p.id);

			expect(getAllPrograms(db)).toHaveLength(0);
			// The exercises library entry should still exist
			const allExercises = db.select().from(exercises).all();
			expect(allExercises).toHaveLength(1);
			expect(allExercises[0].name).toBe('Squat');
		});
	});

	describe('duplicateProgram', () => {
		it('returns null for non-existent program', () => {
			const result = duplicateProgram(db, 999, 'Copy');

			expect(result).toBeNull();
		});

		it('creates exact copy with new name', () => {
			const p = createProgram(db, 'Original');
			const day = addWorkoutDay(db, p.id, 'Upper');
			addDayExercise(db, day.id, 'Bench Press', 4);
			addDayExercise(db, day.id, 'Row', 3);

			const copy = duplicateProgram(db, p.id, 'Copy of Original');

			expect(copy).not.toBeNull();
			expect(copy!.name).toBe('Copy of Original');
			expect(copy!.id).not.toBe(p.id);
			expect(copy!.days).toHaveLength(1);
			expect(copy!.days[0].name).toBe('Upper');
			expect(copy!.days[0].exercises).toHaveLength(2);
			expect(copy!.days[0].exercises[0].exerciseName).toBe('Bench Press');
			expect(copy!.days[0].exercises[0].setsCount).toBe(4);
			expect(copy!.days[0].exercises[1].exerciseName).toBe('Row');
			expect(copy!.days[0].exercises[1].setsCount).toBe(3);
		});

		it('preserves all days and exercises', () => {
			const p = createProgram(db, 'Source');
			const d1 = addWorkoutDay(db, p.id, 'Push');
			const d2 = addWorkoutDay(db, p.id, 'Pull');
			addDayExercise(db, d1.id, 'Bench Press', 4);
			addDayExercise(db, d2.id, 'Deadlift', 5);
			addDayExercise(db, d2.id, 'Barbell Row', 3);

			const copy = duplicateProgram(db, p.id, 'Duplicate');

			expect(copy!.days).toHaveLength(2);
			expect(copy!.days[0].exercises).toHaveLength(1);
			expect(copy!.days[1].exercises).toHaveLength(2);
		});

		it('does not affect the original program', () => {
			const p = createProgram(db, 'Original');
			const day = addWorkoutDay(db, p.id, 'Leg Day');
			addDayExercise(db, day.id, 'Squat');

			duplicateProgram(db, p.id, 'Copy');

			const original = getProgram(db, p.id);
			expect(original!.name).toBe('Original');
			expect(original!.days).toHaveLength(1);
			expect(original!.days[0].exercises).toHaveLength(1);
		});
	});

	describe('setActiveProgram', () => {
		it('activates the given program', () => {
			const p = createProgram(db, 'To Activate');
			setActiveProgram(db, p.id);

			const result = getProgram(db, p.id);
			expect(result!.isActive).toBe(true);
		});

		it('deactivates all other programs', () => {
			const p1 = createProgram(db, 'First');
			const p2 = createProgram(db, 'Second');

			setActiveProgram(db, p1.id);
			setActiveProgram(db, p2.id);

			const all = getAllPrograms(db);
			const active = all.filter((p) => p.isActive);
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(p2.id);
		});

		it('only one program is active at a time', () => {
			const p1 = createProgram(db, 'A');
			const p2 = createProgram(db, 'B');
			const p3 = createProgram(db, 'C');

			setActiveProgram(db, p1.id);
			expect(getAllPrograms(db).filter((p) => p.isActive)).toHaveLength(1);

			setActiveProgram(db, p2.id);
			expect(getAllPrograms(db).filter((p) => p.isActive)).toHaveLength(1);

			setActiveProgram(db, p3.id);
			const active = getAllPrograms(db).filter((p) => p.isActive);
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(p3.id);
		});
	});

	describe('getActiveProgram', () => {
		it('returns null when no program is active', () => {
			createProgram(db, 'Inactive');

			const result = getActiveProgram(db);
			expect(result).toBeNull();
		});

		it('returns the active program with full structure', () => {
			const p = createProgram(db, 'Active Program');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			addDayExercise(db, day.id, 'Bench Press');

			setActiveProgram(db, p.id);

			const result = getActiveProgram(db);

			expect(result).not.toBeNull();
			expect(result!.name).toBe('Active Program');
			expect(result!.isActive).toBe(true);
			expect(result!.days).toHaveLength(1);
			expect(result!.days[0].exercises).toHaveLength(1);
			expect(result!.days[0].exercises[0].exerciseName).toBe('Bench Press');
		});
	});

	describe('addWorkoutDay', () => {
		it('adds a day with sort order 0 for first day', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			expect(day.name).toBe('Day 1');
			expect(day.sortOrder).toBe(0);
			expect(day.programId).toBe(p.id);
		});

		it('maintains incrementing sort order', () => {
			const p = createProgram(db, 'Test');
			const d1 = addWorkoutDay(db, p.id, 'Day 1');
			const d2 = addWorkoutDay(db, p.id, 'Day 2');
			const d3 = addWorkoutDay(db, p.id, 'Day 3');

			expect(d1.sortOrder).toBe(0);
			expect(d2.sortOrder).toBe(1);
			expect(d3.sortOrder).toBe(2);
		});
	});

	describe('removeWorkoutDay', () => {
		it('removes the day', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			removeWorkoutDay(db, day.id);

			const result = getProgram(db, p.id);
			expect(result!.days).toHaveLength(0);
		});

		it('does not affect other days', () => {
			const p = createProgram(db, 'Test');
			const d1 = addWorkoutDay(db, p.id, 'Day 1');
			addWorkoutDay(db, p.id, 'Day 2');

			removeWorkoutDay(db, d1.id);

			const result = getProgram(db, p.id);
			expect(result!.days).toHaveLength(1);
			expect(result!.days[0].name).toBe('Day 2');
		});
	});

	describe('renameWorkoutDay', () => {
		it('renames the day correctly', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Old Name');

			const renamed = renameWorkoutDay(db, day.id, 'New Name');

			expect(renamed!.name).toBe('New Name');
			expect(renamed!.id).toBe(day.id);
		});
	});

	describe('reorderWorkoutDays', () => {
		it('updates sort orders correctly', () => {
			const p = createProgram(db, 'Test');
			const d1 = addWorkoutDay(db, p.id, 'Day 1');
			const d2 = addWorkoutDay(db, p.id, 'Day 2');
			const d3 = addWorkoutDay(db, p.id, 'Day 3');

			// Reverse the order
			reorderWorkoutDays(db, p.id, [d3.id, d1.id, d2.id]);

			const result = getProgram(db, p.id);
			expect(result!.days[0].name).toBe('Day 3');
			expect(result!.days[0].sortOrder).toBe(0);
			expect(result!.days[1].name).toBe('Day 1');
			expect(result!.days[1].sortOrder).toBe(1);
			expect(result!.days[2].name).toBe('Day 2');
			expect(result!.days[2].sortOrder).toBe(2);
		});
	});

	describe('addDayExercise', () => {
		it('adds exercise to day with default sets count', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			const de = addDayExercise(db, day.id, 'Bench Press');

			expect(de.workoutDayId).toBe(day.id);
			expect(de.setsCount).toBe(3);
			expect(de.sortOrder).toBe(0);
		});

		it('adds exercise with custom sets count', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			const de = addDayExercise(db, day.id, 'Squat', 5);

			expect(de.setsCount).toBe(5);
		});

		it('auto-creates exercise in library if new', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			addDayExercise(db, day.id, 'New Exercise');

			const allExercises = db.select().from(exercises).all();
			expect(allExercises).toHaveLength(1);
			expect(allExercises[0].name).toBe('New Exercise');
		});

		it('uses existing exercise if name matches', () => {
			const p = createProgram(db, 'Test');
			const d1 = addWorkoutDay(db, p.id, 'Day 1');
			const d2 = addWorkoutDay(db, p.id, 'Day 2');

			addDayExercise(db, d1.id, 'Bench Press');
			addDayExercise(db, d2.id, 'Bench Press');

			// Only one exercise entry in the library
			const allExercises = db.select().from(exercises).all();
			expect(allExercises).toHaveLength(1);
		});

		it('maintains incrementing sort order for exercises', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');

			const e1 = addDayExercise(db, day.id, 'Bench Press');
			const e2 = addDayExercise(db, day.id, 'Overhead Press');
			const e3 = addDayExercise(db, day.id, 'Dips');

			expect(e1.sortOrder).toBe(0);
			expect(e2.sortOrder).toBe(1);
			expect(e3.sortOrder).toBe(2);
		});
	});

	describe('removeDayExercise', () => {
		it('removes exercise from day', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			const de = addDayExercise(db, day.id, 'Bench Press');

			removeDayExercise(db, de.id);

			const result = getProgram(db, p.id);
			expect(result!.days[0].exercises).toHaveLength(0);
		});

		it('does not remove the exercise from the library', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			const de = addDayExercise(db, day.id, 'Bench Press');

			removeDayExercise(db, de.id);

			const allExercises = db.select().from(exercises).all();
			expect(allExercises).toHaveLength(1);
		});
	});

	describe('updateDayExerciseSets', () => {
		it('updates set count', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			const de = addDayExercise(db, day.id, 'Bench Press', 3);

			const updated = updateDayExerciseSets(db, de.id, 5);

			expect(updated!.setsCount).toBe(5);
			expect(updated!.id).toBe(de.id);
		});
	});

	describe('reorderDayExercises', () => {
		it('updates sort orders correctly', () => {
			const p = createProgram(db, 'Test');
			const day = addWorkoutDay(db, p.id, 'Day 1');
			const e1 = addDayExercise(db, day.id, 'Bench Press');
			const e2 = addDayExercise(db, day.id, 'Overhead Press');
			const e3 = addDayExercise(db, day.id, 'Dips');

			// Reverse the order
			reorderDayExercises(db, day.id, [e3.id, e1.id, e2.id]);

			const result = getProgram(db, p.id);
			const dayExs = result!.days[0].exercises;
			expect(dayExs[0].exerciseName).toBe('Dips');
			expect(dayExs[0].sortOrder).toBe(0);
			expect(dayExs[1].exerciseName).toBe('Bench Press');
			expect(dayExs[1].sortOrder).toBe(1);
			expect(dayExs[2].exerciseName).toBe('Overhead Press');
			expect(dayExs[2].sortOrder).toBe(2);
		});
	});
});
