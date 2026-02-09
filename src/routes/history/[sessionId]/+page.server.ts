import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getSessionDetail, deleteSession, deleteExerciseLog } from '$lib/server/db/queries/history';

export const load: PageServerLoad = async ({ params }) => {
	const sessionId = Number(params.sessionId);
	if (isNaN(sessionId)) error(404, 'Invalid session ID');

	const session = getSessionDetail(db, sessionId);
	if (!session) error(404, 'Session not found');

	return { session };
};

export const actions: Actions = {
	deleteSession: async ({ request }) => {
		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));

		if (isNaN(sessionId)) return fail(400, { error: 'Invalid session ID' });

		deleteSession(db, sessionId);
		redirect(303, '/history');
	},
	deleteExerciseLog: async ({ request }) => {
		const formData = await request.formData();
		const exerciseLogId = Number(formData.get('exerciseLogId'));

		if (isNaN(exerciseLogId)) return fail(400, { error: 'Invalid exercise log ID' });

		deleteExerciseLog(db, exerciseLogId);
	}
};
