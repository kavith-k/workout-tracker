import { eq, and, asc, desc, lt, isNotNull, max, sql } from 'drizzle-orm';
import {
	workoutSessions,
	exerciseLogs,
	setLogs,
	workoutDays,
	dayExercises,
	exercises,
	programs
} from '../schema';
import type { createTestDb } from '../test-helper';

type Db = ReturnType<typeof createTestDb>;

const STALE_WORKOUT_HOURS = 4;

export type WorkoutSession = typeof workoutSessions.$inferSelect & {
	exerciseLogs: Array<
		typeof exerciseLogs.$inferSelect & {
			sets: Array<typeof setLogs.$inferSelect>;
		}
	>;
};

export type ProgressiveOverload = {
	previous: Array<{ weight: number; reps: number; unit: string; date: Date }> | null;
	max: { weight: number; reps: number; unit: string; date: Date } | null;
};

export type WorkoutSummary = {
	sessionId: number;
	programName: string;
	dayName: string;
	startedAt: Date;
	completedAt: Date | null;
	totalExercises: number;
	completedExercises: number;
	skippedExercises: number;
	totalSets: number;
	totalVolume: number;
	durationMinutes: number | null;
	prs: Array<{ exerciseName: string; weight: number; reps: number; unit: string }>;
};

export function getInProgressWorkout(db: Db) {
	return (
		db.select().from(workoutSessions).where(eq(workoutSessions.status, 'in_progress')).get() ?? null
	);
}

export function startWorkout(db: Db, workoutDayId: number) {
	const existing = getInProgressWorkout(db);
	if (existing) {
		throw new Error('A workout is already in progress');
	}

	const day = db.select().from(workoutDays).where(eq(workoutDays.id, workoutDayId)).get();
	if (!day) {
		throw new Error('Workout day not found');
	}

	const program = db.select().from(programs).where(eq(programs.id, day.programId)).get();
	if (!program) {
		throw new Error('Program not found');
	}

	const session = db
		.insert(workoutSessions)
		.values({
			programId: program.id,
			workoutDayId: day.id,
			programName: program.name,
			dayName: day.name,
			status: 'in_progress'
		})
		.returning()
		.get();

	const dayExs = db
		.select({
			id: dayExercises.id,
			exerciseId: dayExercises.exerciseId,
			setsCount: dayExercises.setsCount,
			sortOrder: dayExercises.sortOrder,
			exerciseName: exercises.name,
			unitPreference: exercises.unitPreference
		})
		.from(dayExercises)
		.innerJoin(exercises, eq(dayExercises.exerciseId, exercises.id))
		.where(eq(dayExercises.workoutDayId, workoutDayId))
		.orderBy(asc(dayExercises.sortOrder))
		.all();

	for (const ex of dayExs) {
		const log = db
			.insert(exerciseLogs)
			.values({
				exerciseId: ex.exerciseId,
				sessionId: session.id,
				exerciseName: ex.exerciseName,
				status: 'logged',
				isAdhoc: false,
				sortOrder: ex.sortOrder
			})
			.returning()
			.get();

		for (let i = 0; i < ex.setsCount; i++) {
			db.insert(setLogs)
				.values({
					exerciseLogId: log.id,
					setNumber: i + 1,
					weight: null,
					reps: null,
					unit: ex.unitPreference
				})
				.run();
		}
	}

	return session;
}

export function getPrescribedSetCounts(
	db: Db,
	sessionId: number
): Record<number, number> {
	const session = db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)).get();
	if (!session?.workoutDayId) return {};

	const dayExs = db
		.select({
			exerciseId: dayExercises.exerciseId,
			setsCount: dayExercises.setsCount
		})
		.from(dayExercises)
		.where(eq(dayExercises.workoutDayId, session.workoutDayId))
		.all();

	const exerciseIdToSets: Record<number, number> = {};
	for (const de of dayExs) {
		exerciseIdToSets[de.exerciseId] = de.setsCount;
	}

	const logs = db
		.select({ id: exerciseLogs.id, exerciseId: exerciseLogs.exerciseId })
		.from(exerciseLogs)
		.where(eq(exerciseLogs.sessionId, sessionId))
		.all();

	const result: Record<number, number> = {};
	for (const log of logs) {
		if (log.exerciseId && exerciseIdToSets[log.exerciseId] != null) {
			result[log.id] = exerciseIdToSets[log.exerciseId];
		}
	}
	return result;
}

export function getWorkoutSession(db: Db, sessionId: number): WorkoutSession | null {
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

export function updateSetLog(
	db: Db,
	setLogId: number,
	data: { weight?: number | null; reps?: number | null; unit?: 'kg' | 'lbs' }
) {
	return db.update(setLogs).set(data).where(eq(setLogs.id, setLogId)).returning().get();
}

export function skipExercise(db: Db, exerciseLogId: number) {
	return db
		.update(exerciseLogs)
		.set({ status: 'skipped' })
		.where(eq(exerciseLogs.id, exerciseLogId))
		.returning()
		.get();
}

export function unskipExercise(db: Db, exerciseLogId: number) {
	return db
		.update(exerciseLogs)
		.set({ status: 'logged' })
		.where(eq(exerciseLogs.id, exerciseLogId))
		.returning()
		.get();
}

export function addAdhocExercise(db: Db, sessionId: number, exerciseName: string) {
	// Create exercise if it doesn't exist
	db.insert(exercises)
		.values({ name: exerciseName })
		.onConflictDoNothing({ target: exercises.name })
		.run();

	const exercise = db.select().from(exercises).where(eq(exercises.name, exerciseName)).get()!;

	// Get max sort order for this session
	const result = db
		.select({ maxOrder: max(exerciseLogs.sortOrder) })
		.from(exerciseLogs)
		.where(eq(exerciseLogs.sessionId, sessionId))
		.get();

	const sortOrder = result?.maxOrder != null ? result.maxOrder + 1 : 0;

	const log = db
		.insert(exerciseLogs)
		.values({
			exerciseId: exercise.id,
			sessionId,
			exerciseName: exercise.name,
			status: 'logged',
			isAdhoc: true,
			sortOrder
		})
		.returning()
		.get();

	// Create 3 default sets
	for (let i = 0; i < 3; i++) {
		db.insert(setLogs)
			.values({
				exerciseLogId: log.id,
				setNumber: i + 1,
				weight: null,
				reps: null,
				unit: exercise.unitPreference
			})
			.run();
	}

	return log;
}

export function addSetToExerciseLog(db: Db, exerciseLogId: number) {
	const result = db
		.select({ maxSet: max(setLogs.setNumber) })
		.from(setLogs)
		.where(eq(setLogs.exerciseLogId, exerciseLogId))
		.get();

	const setNumber = result?.maxSet != null ? result.maxSet + 1 : 1;

	// Get the unit from the exercise log's exercise
	const log = db.select().from(exerciseLogs).where(eq(exerciseLogs.id, exerciseLogId)).get();
	let unit: 'kg' | 'lbs' = 'kg';
	if (log?.exerciseId) {
		const exercise = db.select().from(exercises).where(eq(exercises.id, log.exerciseId)).get();
		if (exercise) unit = exercise.unitPreference;
	}

	return db
		.insert(setLogs)
		.values({
			exerciseLogId,
			setNumber,
			weight: null,
			reps: null,
			unit
		})
		.returning()
		.get();
}

export function removeSetFromExerciseLog(db: Db, setLogId: number) {
	return db.delete(setLogs).where(eq(setLogs.id, setLogId)).run();
}

export function completeWorkout(
	db: Db,
	sessionId: number
): { cancelled: true } | (typeof workoutSessions.$inferSelect & { cancelled?: false }) {
	// Mark any exercise logs that have no filled sets as skipped
	const logs = db
		.select()
		.from(exerciseLogs)
		.where(and(eq(exerciseLogs.sessionId, sessionId), eq(exerciseLogs.status, 'logged')))
		.all();

	for (const log of logs) {
		const filledSets = db
			.select()
			.from(setLogs)
			.where(and(eq(setLogs.exerciseLogId, log.id), isNotNull(setLogs.reps)))
			.all();

		if (filledSets.length === 0) {
			db.update(exerciseLogs).set({ status: 'skipped' }).where(eq(exerciseLogs.id, log.id)).run();
		}
	}

	// Check if any exercise still has status='logged' (i.e. has at least one set with reps)
	const loggedExercises = db
		.select()
		.from(exerciseLogs)
		.where(and(eq(exerciseLogs.sessionId, sessionId), eq(exerciseLogs.status, 'logged')))
		.all();

	if (loggedExercises.length === 0) {
		// No exercises were logged -- cancel the workout by deleting all data
		const allLogs = db
			.select()
			.from(exerciseLogs)
			.where(eq(exerciseLogs.sessionId, sessionId))
			.all();

		for (const log of allLogs) {
			db.delete(setLogs).where(eq(setLogs.exerciseLogId, log.id)).run();
		}
		db.delete(exerciseLogs).where(eq(exerciseLogs.sessionId, sessionId)).run();
		db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();

		return { cancelled: true };
	}

	return db
		.update(workoutSessions)
		.set({ status: 'completed', completedAt: new Date() })
		.where(eq(workoutSessions.id, sessionId))
		.returning()
		.get()!;
}

export function getWorkoutSummary(db: Db, sessionId: number): WorkoutSummary | null {
	const session = db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)).get();
	if (!session) return null;

	const logs = db.select().from(exerciseLogs).where(eq(exerciseLogs.sessionId, sessionId)).all();

	const totalExercises = logs.filter((l) => !l.isAdhoc).length;
	const skippedExercises = logs.filter((l) => l.status === 'skipped' && !l.isAdhoc).length;
	const completedExercises = totalExercises - skippedExercises;

	// Compute total sets and volume across all logged exercises (including ad-hoc)
	const allSets = db
		.select()
		.from(setLogs)
		.innerJoin(exerciseLogs, eq(setLogs.exerciseLogId, exerciseLogs.id))
		.where(
			and(
				eq(exerciseLogs.sessionId, sessionId),
				eq(exerciseLogs.status, 'logged'),
				isNotNull(setLogs.weight)
			)
		)
		.all();

	const LBS_TO_KG = 0.453592;
	const totalSets = allSets.length;
	const totalVolume = allSets.reduce((sum, row) => {
		const weight = row.set_logs.weight ?? 0;
		const reps = row.set_logs.reps ?? 0;
		const weightKg = row.set_logs.unit === 'lbs' ? weight * LBS_TO_KG : weight;
		return sum + weightKg * reps;
	}, 0);

	const durationMinutes =
		session.completedAt && session.startedAt
			? Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / (1000 * 60))
			: null;

	// Detect PRs: for each logged exercise, check if any set in this session
	// has a higher weight than any previous session
	const prs: WorkoutSummary['prs'] = [];

	const loggedExercises = logs.filter((l) => l.status === 'logged' && l.exerciseId != null);

	for (const log of loggedExercises) {
		const sessionSets = db
			.select()
			.from(setLogs)
			.where(and(eq(setLogs.exerciseLogId, log.id), isNotNull(setLogs.weight)))
			.orderBy(desc(setLogs.weight))
			.all();

		if (sessionSets.length === 0) continue;

		const heaviestInSession = sessionSets[0];

		// Get previous max weight for this exercise (from other completed sessions)
		const previousMax = db
			.select({ weight: setLogs.weight })
			.from(setLogs)
			.innerJoin(exerciseLogs, eq(setLogs.exerciseLogId, exerciseLogs.id))
			.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
			.where(
				and(
					eq(exerciseLogs.exerciseId, log.exerciseId!),
					eq(exerciseLogs.status, 'logged'),
					eq(workoutSessions.status, 'completed'),
					isNotNull(setLogs.weight),
					sql`${workoutSessions.id} != ${sessionId}`
				)
			)
			.orderBy(desc(setLogs.weight))
			.limit(1)
			.get();

		const isNewPR = !previousMax || (heaviestInSession.weight ?? 0) > (previousMax.weight ?? 0);

		if (isNewPR && heaviestInSession.weight != null) {
			prs.push({
				exerciseName: log.exerciseName,
				weight: heaviestInSession.weight,
				reps: heaviestInSession.reps ?? 0,
				unit: heaviestInSession.unit
			});
		}
	}

	return {
		sessionId: session.id,
		programName: session.programName,
		dayName: session.dayName,
		startedAt: session.startedAt,
		completedAt: session.completedAt,
		totalExercises,
		completedExercises,
		skippedExercises,
		totalSets,
		totalVolume,
		durationMinutes,
		prs
	};
}

export function getPreviousPerformance(db: Db, exerciseId: number) {
	// Get the most recent completed session where this exercise was logged (not skipped)
	const lastLog = db
		.select({
			exerciseLogId: exerciseLogs.id,
			date: workoutSessions.completedAt
		})
		.from(exerciseLogs)
		.innerJoin(workoutSessions, eq(exerciseLogs.sessionId, workoutSessions.id))
		.where(
			and(
				eq(exerciseLogs.exerciseId, exerciseId),
				eq(exerciseLogs.status, 'logged'),
				eq(workoutSessions.status, 'completed'),
				isNotNull(workoutSessions.completedAt)
			)
		)
		.orderBy(desc(workoutSessions.completedAt), desc(workoutSessions.id))
		.limit(1)
		.get();

	if (!lastLog) return null;

	const sets = db
		.select()
		.from(setLogs)
		.where(and(eq(setLogs.exerciseLogId, lastLog.exerciseLogId), isNotNull(setLogs.weight)))
		.orderBy(asc(setLogs.setNumber))
		.all();

	if (sets.length === 0) return null;

	return {
		date: lastLog.date!,
		sets: sets.map((s) => ({
			weight: s.weight!,
			reps: s.reps ?? 0,
			unit: s.unit
		}))
	};
}

export function getMaxPerformance(db: Db, exerciseId: number) {
	const row = db
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

	if (!row) return null;

	return {
		weight: row.weight!,
		reps: row.reps ?? 0,
		unit: row.unit,
		date: row.date!
	};
}

export function closeStaleWorkouts(db: Db) {
	const cutoff = new Date(Date.now() - STALE_WORKOUT_HOURS * 60 * 60 * 1000);

	const stale = db
		.select()
		.from(workoutSessions)
		.where(and(eq(workoutSessions.status, 'in_progress'), lt(workoutSessions.startedAt, cutoff)))
		.all();

	for (const session of stale) {
		completeWorkout(db, session.id);
	}

	return stale.length;
}

export function getCompletedWorkoutDates(db: Db, since: Date): string[] {
	const rows = db
		.select({ completedAt: workoutSessions.completedAt })
		.from(workoutSessions)
		.where(
			and(
				eq(workoutSessions.status, 'completed'),
				isNotNull(workoutSessions.completedAt),
				sql`${workoutSessions.completedAt} >= ${since.getTime()}`
			)
		)
		.all();

	return rows
		.filter((r) => r.completedAt != null)
		.map((r) => {
			const d = r.completedAt!;
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		});
}

export function updateExerciseUnitPreference(db: Db, exerciseId: number, unit: 'kg' | 'lbs') {
	return db
		.update(exercises)
		.set({ unitPreference: unit })
		.where(eq(exercises.id, exerciseId))
		.returning()
		.get();
}
