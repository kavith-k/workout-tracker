import { eq, and, asc, desc, count } from 'drizzle-orm';
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

export function deleteSession(db: Db, sessionId: number) {
	return db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
}

export function deleteExerciseLog(db: Db, exerciseLogId: number) {
	return db.delete(exerciseLogs).where(eq(exerciseLogs.id, exerciseLogId)).run();
}
