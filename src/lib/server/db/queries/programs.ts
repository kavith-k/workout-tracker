import { eq, asc, max, and } from 'drizzle-orm';
import { programs, workoutDays, dayExercises, exercises } from '../schema';
import type { createTestDb } from '../test-helper';

type Db = ReturnType<typeof createTestDb>;

function buildProgramWithDaysAndExercises(db: Db, programId: number): ProgramWithDays | null {
	const program = db.select().from(programs).where(eq(programs.id, programId)).get();
	if (!program) return null;

	const days = db
		.select()
		.from(workoutDays)
		.where(eq(workoutDays.programId, programId))
		.orderBy(asc(workoutDays.sortOrder))
		.all();

	const daysWithExercises = days.map((day) => {
		const exs = db
			.select({
				id: dayExercises.id,
				exerciseId: dayExercises.exerciseId,
				setsCount: dayExercises.setsCount,
				sortOrder: dayExercises.sortOrder,
				createdAt: dayExercises.createdAt,
				exerciseName: exercises.name,
				unitPreference: exercises.unitPreference
			})
			.from(dayExercises)
			.innerJoin(exercises, eq(dayExercises.exerciseId, exercises.id))
			.where(eq(dayExercises.workoutDayId, day.id))
			.orderBy(asc(dayExercises.sortOrder))
			.all();

		return { ...day, exercises: exs };
	});

	return { ...program, days: daysWithExercises };
}

export type ProgramWithDays = typeof programs.$inferSelect & {
	days: Array<
		typeof workoutDays.$inferSelect & {
			exercises: Array<{
				id: number;
				exerciseId: number;
				setsCount: number;
				sortOrder: number;
				createdAt: Date;
				exerciseName: string;
				unitPreference: string;
			}>;
		}
	>;
};

export function createProgram(db: Db, name: string) {
	return db.insert(programs).values({ name }).returning().get();
}

export function getProgram(db: Db, id: number): ProgramWithDays | null {
	return buildProgramWithDaysAndExercises(db, id);
}

export function getAllPrograms(db: Db) {
	return db.select().from(programs).orderBy(asc(programs.name)).all();
}

export function updateProgram(db: Db, id: number, data: { name: string }) {
	return db
		.update(programs)
		.set({ name: data.name, updatedAt: new Date() })
		.where(eq(programs.id, id))
		.returning()
		.get();
}

export function deleteProgram(db: Db, id: number) {
	return db.delete(programs).where(eq(programs.id, id)).run();
}

export function duplicateProgram(db: Db, id: number, newName: string) {
	const source = buildProgramWithDaysAndExercises(db, id);
	if (!source) return null;

	const newProgram = db.insert(programs).values({ name: newName }).returning().get();

	for (const day of source.days) {
		const newDay = db
			.insert(workoutDays)
			.values({
				programId: newProgram.id,
				name: day.name,
				sortOrder: day.sortOrder
			})
			.returning()
			.get();

		for (const ex of day.exercises) {
			db.insert(dayExercises)
				.values({
					workoutDayId: newDay.id,
					exerciseId: ex.exerciseId,
					setsCount: ex.setsCount,
					sortOrder: ex.sortOrder
				})
				.run();
		}
	}

	return buildProgramWithDaysAndExercises(db, newProgram.id);
}

export function setActiveProgram(db: Db, id: number) {
	db.update(programs).set({ isActive: false }).run();
	return db.update(programs).set({ isActive: true }).where(eq(programs.id, id)).returning().get();
}

export function getActiveProgram(db: Db): ProgramWithDays | null {
	const program = db.select().from(programs).where(eq(programs.isActive, true)).get();
	if (!program) return null;
	return buildProgramWithDaysAndExercises(db, program.id);
}

export function addWorkoutDay(db: Db, programId: number, name: string) {
	const result = db
		.select({ maxOrder: max(workoutDays.sortOrder) })
		.from(workoutDays)
		.where(eq(workoutDays.programId, programId))
		.get();

	const sortOrder = result?.maxOrder != null ? result.maxOrder + 1 : 0;

	return db.insert(workoutDays).values({ programId, name, sortOrder }).returning().get();
}

export function removeWorkoutDay(db: Db, dayId: number) {
	return db.delete(workoutDays).where(eq(workoutDays.id, dayId)).run();
}

export function renameWorkoutDay(db: Db, dayId: number, name: string) {
	return db.update(workoutDays).set({ name }).where(eq(workoutDays.id, dayId)).returning().get();
}

export function reorderWorkoutDays(db: Db, programId: number, dayIds: number[]) {
	for (let i = 0; i < dayIds.length; i++) {
		db.update(workoutDays)
			.set({ sortOrder: i })
			.where(and(eq(workoutDays.id, dayIds[i]), eq(workoutDays.programId, programId)))
			.run();
	}
}

export function addDayExercise(db: Db, dayId: number, exerciseName: string, setsCount: number = 3) {
	// Create exercise if it doesn't exist
	db.insert(exercises)
		.values({ name: exerciseName })
		.onConflictDoNothing({ target: exercises.name })
		.run();

	const exercise = db.select().from(exercises).where(eq(exercises.name, exerciseName)).get()!;

	const result = db
		.select({ maxOrder: max(dayExercises.sortOrder) })
		.from(dayExercises)
		.where(eq(dayExercises.workoutDayId, dayId))
		.get();

	const sortOrder = result?.maxOrder != null ? result.maxOrder + 1 : 0;

	return db
		.insert(dayExercises)
		.values({
			workoutDayId: dayId,
			exerciseId: exercise.id,
			setsCount,
			sortOrder
		})
		.returning()
		.get();
}

export function removeDayExercise(db: Db, dayExerciseId: number) {
	return db.delete(dayExercises).where(eq(dayExercises.id, dayExerciseId)).run();
}

export function updateDayExerciseSets(db: Db, dayExerciseId: number, setsCount: number) {
	return db
		.update(dayExercises)
		.set({ setsCount })
		.where(eq(dayExercises.id, dayExerciseId))
		.returning()
		.get();
}

export function reorderDayExercises(db: Db, dayId: number, dayExerciseIds: number[]) {
	for (let i = 0; i < dayExerciseIds.length; i++) {
		db.update(dayExercises)
			.set({ sortOrder: i })
			.where(and(eq(dayExercises.id, dayExerciseIds[i]), eq(dayExercises.workoutDayId, dayId)))
			.run();
	}
}
