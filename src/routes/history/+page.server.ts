import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getSessionsByDate, deleteSession } from '$lib/server/db/queries/history';

export const load: PageServerLoad = async ({ url }) => {
	const page = Number(url.searchParams.get('page') ?? '1');
	const limit = 20;
	const result = getSessionsByDate(db, page, limit);
	return { ...result, page, limit };
};

export const actions: Actions = {
	deleteSession: async ({ request }) => {
		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));

		if (isNaN(sessionId)) {
			return fail(400, { error: 'Invalid session ID' });
		}

		deleteSession(db, sessionId);
	}
};
