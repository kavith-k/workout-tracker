import { eq, asc, desc, and, isNotNull } from 'drizzle-orm';
import {
	programs,
	workoutDays,
	dayExercises,
	exercises,
	workoutSessions,
	exerciseLogs,
	setLogs
} from '../schema';
import type { createTestDb } from '../test-helper';

type Db = ReturnType<typeof createTestDb>;

export type ExportJSON = {
	exportedAt: string;
	version: '1.0';
	programs: Array<{
		id: number;
		name: string;
		isActive: boolean;
		days: Array<{
			id: number;
			name: string;
			sortOrder: number;
			exercises: Array<{
				id: number;
				name: string;
				setsCount: number;
				sortOrder: number;
				lastPerformed: {
					date: string;
					weight: number;
					reps: number;
					unit: string;
				} | null;
				maxWeight: {
					date: string;
					weight: number;
					reps: number;
					unit: string;
				} | null;
			}>;
		}>;
	}>;
	exercises: Array<{
		id: number;
		name: string;
		unitPreference: string;
	}>;
};

function getLastPerformed(db: Db, exerciseId: number) {
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
		.orderBy(desc(workoutSessions.completedAt), desc(setLogs.weight))
		.limit(1)
		.get();

	if (!row || !row.date) return null;

	return {
		date: row.date.toISOString(),
		weight: row.weight!,
		reps: row.reps ?? 0,
		unit: row.unit
	};
}

function getMaxWeight(db: Db, exerciseId: number) {
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

	if (!row || !row.date) return null;

	return {
		date: row.date.toISOString(),
		weight: row.weight!,
		reps: row.reps ?? 0,
		unit: row.unit
	};
}

export function exportAsJSON(db: Db): ExportJSON {
	const allPrograms = db.select().from(programs).orderBy(asc(programs.name)).all();

	const programsData = allPrograms.map((program) => {
		const days = db
			.select()
			.from(workoutDays)
			.where(eq(workoutDays.programId, program.id))
			.orderBy(asc(workoutDays.sortOrder))
			.all();

		const daysData = days.map((day) => {
			const exs = db
				.select({
					id: dayExercises.id,
					exerciseId: dayExercises.exerciseId,
					setsCount: dayExercises.setsCount,
					sortOrder: dayExercises.sortOrder,
					exerciseName: exercises.name
				})
				.from(dayExercises)
				.innerJoin(exercises, eq(dayExercises.exerciseId, exercises.id))
				.where(eq(dayExercises.workoutDayId, day.id))
				.orderBy(asc(dayExercises.sortOrder))
				.all();

			const exercisesData = exs.map((ex) => ({
				id: ex.id,
				name: ex.exerciseName,
				setsCount: ex.setsCount,
				sortOrder: ex.sortOrder,
				lastPerformed: getLastPerformed(db, ex.exerciseId),
				maxWeight: getMaxWeight(db, ex.exerciseId)
			}));

			return {
				id: day.id,
				name: day.name,
				sortOrder: day.sortOrder,
				exercises: exercisesData
			};
		});

		return {
			id: program.id,
			name: program.name,
			isActive: program.isActive,
			days: daysData
		};
	});

	const allExercises = db.select().from(exercises).orderBy(asc(exercises.name)).all();

	return {
		exportedAt: new Date().toISOString(),
		version: '1.0',
		programs: programsData,
		exercises: allExercises.map((ex) => ({
			id: ex.id,
			name: ex.name,
			unitPreference: ex.unitPreference
		}))
	};
}

function formatDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

function escapeCSV(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return '"' + value.replace(/"/g, '""') + '"';
	}
	return value;
}

export function exportAsCSV(db: Db): string {
	const header =
		'session_date,session_id,program_name,day_name,exercise_name,exercise_status,set_number,weight,reps,unit';

	const sessions = db
		.select()
		.from(workoutSessions)
		.where(eq(workoutSessions.status, 'completed'))
		.orderBy(asc(workoutSessions.completedAt))
		.all();

	const rows: string[] = [];

	for (const session of sessions) {
		const logs = db
			.select()
			.from(exerciseLogs)
			.where(eq(exerciseLogs.sessionId, session.id))
			.orderBy(asc(exerciseLogs.sortOrder))
			.all();

		for (const log of logs) {
			if (log.status === 'skipped') {
				rows.push(
					[
						formatDate(session.completedAt ?? session.startedAt),
						session.id,
						escapeCSV(session.programName),
						escapeCSV(session.dayName),
						escapeCSV(log.exerciseName),
						'skipped',
						'',
						'',
						'',
						''
					].join(',')
				);
				continue;
			}

			const sets = db
				.select()
				.from(setLogs)
				.where(eq(setLogs.exerciseLogId, log.id))
				.orderBy(asc(setLogs.setNumber))
				.all();

			for (const set of sets) {
				rows.push(
					[
						formatDate(session.completedAt ?? session.startedAt),
						session.id,
						escapeCSV(session.programName),
						escapeCSV(session.dayName),
						escapeCSV(log.exerciseName),
						'logged',
						set.setNumber,
						set.weight ?? '',
						set.reps ?? '',
						set.unit
					].join(',')
				);
			}
		}
	}

	return [header, ...rows].join('\n');
}
