import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getWorkoutSummary } from '$lib/server/db/queries/workouts';

export const load: PageServerLoad = async ({ params }) => {
	const sessionId = Number(params.sessionId);
	if (isNaN(sessionId)) error(404, 'Invalid session ID');

	const summary = getWorkoutSummary(db, sessionId);
	if (!summary) error(404, 'Workout session not found');

	return { summary };
};
