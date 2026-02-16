import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getActiveProgram } from '$lib/server/db/queries/programs';
import { getCompletedWorkoutDates } from '$lib/server/db/queries/workouts';
import { workoutSessions } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const activeProgram = getActiveProgram(db);

	let lastWorkout: { dayName: string; daysAgo: number } | null = null;
	if (activeProgram) {
		const lastSession = db
			.select()
			.from(workoutSessions)
			.where(eq(workoutSessions.status, 'completed'))
			.orderBy(desc(workoutSessions.completedAt))
			.limit(1)
			.get();

		if (lastSession?.completedAt) {
			const diffMs = Date.now() - lastSession.completedAt.getTime();
			const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			lastWorkout = { dayName: lastSession.dayName, daysAgo };
		}
	}

	const oneYearAgo = new Date();
	oneYearAgo.setDate(oneYearAgo.getDate() - 52 * 7);
	const workoutDates = getCompletedWorkoutDates(db, oneYearAgo);

	return { activeProgram, lastWorkout, workoutDates };
};
