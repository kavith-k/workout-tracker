import { eq, asc, and, desc, isNotNull } from 'drizzle-orm';
import { exercises, exerciseLogs, setLogs, workoutSessions, dayExercises } from '../schema';
import type { createTestDb } from '../test-helper';

type Db = ReturnType<typeof createTestDb>;

export type ExerciseStats = {
	maxWeight: { weight: number; reps: number | null; unit: string; date: Date } | null;
	lastPerformed: Date | null;
};

export type ExerciseWithStats = typeof exercises.$inferSelect & ExerciseStats;

function getStatsForExercise(db: Db, exerciseId: number): ExerciseStats {
	// Max weight: heaviest weight lifted in a completed session with logged status
	const maxWeightRow = db
		.select({
			weight: setLogs.weight,
			reps: setLogs.reps,
			unit: setLogs.unit,
			date: workoutSessions.completedAt
		})
		.from(setLogs)
		.innerJoin(exerciseLogs, eq(setLogs.exerciseLogId, exerciseLogs.id))
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(
			and(
				eq(exerciseLogs.exerciseId, exerciseId),
				eq(exerciseLogs.status, 'logged'),
				eq(workoutSessions.status, 'completed'),
				isNotNull(setLogs.weight)
			)
		)
		.orderBy(desc(setLogs.weight))
		.limit(1)
		.get();

	// Last performed: most recent completed session date
	const lastRow = db
		.select({ completedAt: workoutSessions.completedAt })
		.from(exerciseLogs)
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(
			and(
				eq(exerciseLogs.exerciseId, exerciseId),
				eq(exerciseLogs.status, 'logged'),
				eq(workoutSessions.status, 'completed')
			)
		)
		.orderBy(desc(workoutSessions.completedAt))
		.limit(1)
		.get();

	return {
		maxWeight: maxWeightRow
			? {
					weight: maxWeightRow.weight!,
					reps: maxWeightRow.reps,
					unit: maxWeightRow.unit,
					date: maxWeightRow.date!
				}
			: null,
		lastPerformed: lastRow?.completedAt ?? null
	};
}

export function getAllExercises(db: Db): ExerciseWithStats[] {
	const allExercises = db.select().from(exercises).orderBy(asc(exercises.name)).all();

	return allExercises.map((exercise) => ({
		...exercise,
		...getStatsForExercise(db, exercise.id)
	}));
}

export function renameExercise(db: Db, id: number, newName: string) {
	return db.update(exercises).set({ name: newName }).where(eq(exercises.id, id)).returning().get();
}

export function deleteExercise(db: Db, id: number) {
	const hasHistory = db
		.select({ id: exerciseLogs.id })
		.from(exerciseLogs)
		.where(eq(exerciseLogs.exerciseId, id))
		.limit(1)
		.get();

	// Remove from any program day exercises
	db.delete(dayExercises).where(eq(dayExercises.exerciseId, id)).run();

	// Delete the exercise (exerciseLogs FK is set null on delete)
	db.delete(exercises).where(eq(exercises.id, id)).run();

	return { deleted: true, hadHistory: !!hasHistory };
}

export function getExerciseStats(db: Db, id: number): ExerciseStats {
	return getStatsForExercise(db, id);
}
