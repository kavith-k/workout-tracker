import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-helper';
import { programs, workoutDays, exercises, dayExercises } from './schema';

describe('database schema', () => {
	let db: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		db = createTestDb();
	});

	it('should insert and read a program', () => {
		db.insert(programs).values({ name: 'Push Pull Legs' }).run();

		const result = db.select().from(programs).all();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Push Pull Legs');
		expect(result[0].isActive).toBe(false);
		expect(result[0].id).toBe(1);
		expect(result[0].createdAt).toBeInstanceOf(Date);
		expect(result[0].updatedAt).toBeInstanceOf(Date);
	});

	it('should cascade delete workout days when program is deleted', () => {
		db.insert(programs).values({ name: 'Test Program' }).run();
		const program = db.select().from(programs).get()!;

		db.insert(workoutDays).values({ programId: program.id, name: 'Day 1', sortOrder: 0 }).run();

		expect(db.select().from(workoutDays).all()).toHaveLength(1);

		db.delete(programs).where(eq(programs.id, program.id)).run();

		expect(db.select().from(workoutDays).all()).toHaveLength(0);
	});

	it('should create exercises with unique names', () => {
		db.insert(exercises).values({ name: 'Bench Press' }).run();

		const result = db.select().from(exercises).all();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Bench Press');
		expect(result[0].unitPreference).toBe('kg');
	});

	it('should link exercises to workout days via day_exercises', () => {
		db.insert(programs).values({ name: 'Test Program' }).run();
		const program = db.select().from(programs).get()!;

		db.insert(workoutDays).values({ programId: program.id, name: 'Upper', sortOrder: 0 }).run();
		const day = db.select().from(workoutDays).get()!;

		db.insert(exercises).values({ name: 'Bench Press' }).run();
		const exercise = db.select().from(exercises).get()!;

		db.insert(dayExercises)
			.values({ workoutDayId: day.id, exerciseId: exercise.id, sortOrder: 0 })
			.run();

		const result = db.select().from(dayExercises).all();

		expect(result).toHaveLength(1);
		expect(result[0].workoutDayId).toBe(day.id);
		expect(result[0].exerciseId).toBe(exercise.id);
		expect(result[0].setsCount).toBe(3);
	});
});
