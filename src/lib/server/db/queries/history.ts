import { eq, and, asc, desc, count, countDistinct, sql } from 'drizzle-orm';
import { workoutSessions, exerciseLogs, setLogs } from '../schema';
import type { createTestDb } from '../test-helper';
import type { WorkoutSession } from './workouts';

type Db = ReturnType<typeof createTestDb>;

export type SessionSummary = {
	id: number;
	programName: string;
	dayName: string;
	startedAt: Date;
	completedAt: Date | null;
	exerciseCount: number;
	completedCount: number;
	skippedCount: number;
};

export type ExerciseHistoryEntry = {
	exerciseLogId: number;
	sessionId: number;
	programName: string;
	dayName: string;
	completedAt: Date;
	status: string;
	sets: Array<{ setNumber: number; weight: number | null; reps: number | null; unit: string }>;
};

export type ExerciseWithHistory = {
	id: number;
	name: string;
	sessionCount: number;
	lastPerformed: Date | null;
};

export function getSessionsByDate(
	db: Db,
	page: number = 1,
	limit: number = 20
): { sessions: SessionSummary[]; total: number } {
	const totalResult = db
		.select({ count: count() })
		.from(workoutSessions)
		.where(eq(workoutSessions.status, 'completed'))
		.get();

	const total = totalResult?.count ?? 0;

	const offset = (page - 1) * limit;

	const rows = db
		.select({
			id: workoutSessions.id,
			programName: workoutSessions.programName,
			dayName: workoutSessions.dayName,
			startedAt: workoutSessions.startedAt,
			completedAt: workoutSessions.completedAt
		})
		.from(workoutSessions)
		.where(eq(workoutSessions.status, 'completed'))
		.orderBy(desc(workoutSessions.completedAt))
		.limit(limit)
		.offset(offset)
		.all();

	const sessions: SessionSummary[] = rows.map((row) => {
		const exerciseCount = db
			.select({ count: count() })
			.from(exerciseLogs)
			.where(eq(exerciseLogs.sessionId, row.id))
			.get();

		const skippedCount = db
			.select({ count: count() })
			.from(exerciseLogs)
			.where(and(eq(exerciseLogs.sessionId, row.id), eq(exerciseLogs.status, 'skipped')))
			.get();

		const totalExercises = exerciseCount?.count ?? 0;
		const skipped = skippedCount?.count ?? 0;

		return {
			...row,
			exerciseCount: totalExercises,
			completedCount: totalExercises - skipped,
			skippedCount: skipped
		};
	});

	return { sessions, total };
}

export function getSessionDetail(db: Db, sessionId: number): WorkoutSession | null {
	const session = db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)).get();
	if (!session) return null;

	const logs = db
		.select()
		.from(exerciseLogs)
		.where(eq(exerciseLogs.sessionId, sessionId))
		.orderBy(asc(exerciseLogs.sortOrder))
		.all();

	const logsWithSets = logs.map((log) => {
		const sets = db
			.select()
			.from(setLogs)
			.where(eq(setLogs.exerciseLogId, log.id))
			.orderBy(asc(setLogs.setNumber))
			.all();
		return { ...log, sets };
	});

	return { ...session, exerciseLogs: logsWithSets };
}

export function getHistoryByExercise(db: Db): ExerciseWithHistory[] {
	const rows = db
		.select({
			id: exerciseLogs.exerciseId,
			name: exerciseLogs.exerciseName,
			sessionCount: countDistinct(exerciseLogs.sessionId),
			lastPerformed: sql<Date | null>`MAX(${workoutSessions.completedAt})`
		})
		.from(exerciseLogs)
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(eq(workoutSessions.status, 'completed'))
		.groupBy(exerciseLogs.exerciseId, exerciseLogs.exerciseName)
		.orderBy(asc(exerciseLogs.exerciseName))
		.all();

	return rows.map((row) => ({
		id: row.id!,
		name: row.name,
		sessionCount: row.sessionCount,
		lastPerformed: row.lastPerformed
	}));
}

export function getExerciseHistory(
	db: Db,
	exerciseId: number,
	page: number = 1,
	limit: number = 20
): { entries: ExerciseHistoryEntry[]; total: number } {
	const totalResult = db
		.select({ count: countDistinct(exerciseLogs.id) })
		.from(exerciseLogs)
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(and(eq(exerciseLogs.exerciseId, exerciseId), eq(workoutSessions.status, 'completed')))
		.get();

	const total = totalResult?.count ?? 0;

	const offset = (page - 1) * limit;

	const logs = db
		.select({
			exerciseLogId: exerciseLogs.id,
			sessionId: exerciseLogs.sessionId,
			programName: workoutSessions.programName,
			dayName: workoutSessions.dayName,
			completedAt: workoutSessions.completedAt,
			status: exerciseLogs.status
		})
		.from(exerciseLogs)
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(and(eq(exerciseLogs.exerciseId, exerciseId), eq(workoutSessions.status, 'completed')))
		.orderBy(desc(workoutSessions.completedAt))
		.limit(limit)
		.offset(offset)
		.all();

	const entries: ExerciseHistoryEntry[] = logs.map((log) => {
		const sets = db
			.select({
				setNumber: setLogs.setNumber,
				weight: setLogs.weight,
				reps: setLogs.reps,
				unit: setLogs.unit
			})
			.from(setLogs)
			.where(eq(setLogs.exerciseLogId, log.exerciseLogId))
			.orderBy(asc(setLogs.setNumber))
			.all();

		return {
			...log,
			completedAt: log.completedAt!,
			sets
		};
	});

	return { entries, total };
}

export function deleteSession(db: Db, sessionId: number) {
	return db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
}

export function deleteExerciseLog(db: Db, exerciseLogId: number) {
	return db.delete(exerciseLogs).where(eq(exerciseLogs.id, exerciseLogId)).run();
}
