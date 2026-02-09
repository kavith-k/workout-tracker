import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getAllExercises, renameExercise, deleteExercise } from '$lib/server/db/queries/exercises';

export const load: PageServerLoad = async () => {
	const exercises = getAllExercises(db);
	return { exercises };
};

export const actions: Actions = {
	rename: async ({ request }) => {
		const formData = await request.formData();
		const exerciseId = Number(formData.get('exerciseId'));
		const newName = formData.get('newName');

		if (isNaN(exerciseId)) {
			return fail(400, { error: 'Invalid exercise ID' });
		}

		if (!newName || typeof newName !== 'string' || !newName.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		try {
			renameExercise(db, exerciseId, newName.trim());
		} catch {
			return fail(400, { error: 'An exercise with that name already exists' });
		}
	},
	delete: async ({ request }) => {
		const formData = await request.formData();
		const exerciseId = Number(formData.get('exerciseId'));

		if (isNaN(exerciseId)) {
			return fail(400, { error: 'Invalid exercise ID' });
		}

		deleteExercise(db, exerciseId);
	}
};
