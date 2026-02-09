import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getHistoryByExercise } from '$lib/server/db/queries/history';

export const load: PageServerLoad = async () => {
	const exercises = getHistoryByExercise(db);
	return { exercises };
};
