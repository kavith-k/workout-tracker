import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	getAllPrograms,
	setActiveProgram,
	deleteProgram,
	duplicateProgram
} from '$lib/server/db/queries/programs';

export const load: PageServerLoad = async () => {
	const programs = getAllPrograms(db);
	return { programs };
};

export const actions: Actions = {
	setActive: async ({ request }) => {
		const formData = await request.formData();
		const programId = Number(formData.get('programId'));

		if (isNaN(programId)) {
			return fail(400, { error: 'Invalid program ID' });
		}

		setActiveProgram(db, programId);
	},
	delete: async ({ request }) => {
		const formData = await request.formData();
		const programId = Number(formData.get('programId'));

		if (isNaN(programId)) {
			return fail(400, { error: 'Invalid program ID' });
		}

		deleteProgram(db, programId);
	},
	duplicate: async ({ request }) => {
		const formData = await request.formData();
		const programId = Number(formData.get('programId'));
		const newName = formData.get('newName');

		if (isNaN(programId)) {
			return fail(400, { error: 'Invalid program ID' });
		}

		if (!newName || typeof newName !== 'string' || !newName.trim()) {
			return fail(400, { error: 'New name is required' });
		}

		duplicateProgram(db, programId, newName.trim());
	}
};
