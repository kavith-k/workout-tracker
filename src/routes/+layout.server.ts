import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getInProgressWorkout, closeStaleWorkouts } from '$lib/server/db/queries/workouts';

export const load: LayoutServerLoad = async () => {
	closeStaleWorkouts(db);
	const inProgressWorkout = getInProgressWorkout(db);
	return { inProgressWorkout };
};
