import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { startWorkout } from '$lib/server/db/queries/workouts';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const workoutDayId = Number(formData.get('workoutDayId'));

		if (isNaN(workoutDayId)) {
			return fail(400, { error: 'Invalid workout day ID' });
		}

		let sessionId: number;
		try {
			const session = startWorkout(db, workoutDayId);
			sessionId = session.id;
		} catch (e) {
			if (e instanceof Error && e.message === 'A workout is already in progress') {
				return fail(409, { error: e.message });
			}
			throw e;
		}

		redirect(303, `/workout/${sessionId}`);
	}
};
