import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { createProgram, addWorkoutDay, addDayExercise } from '$lib/server/db/queries/programs';
import { validateProgramUpload } from '$lib/schemas/program-upload';

function formatTimestamp(date: Date): string {
	const yy = String(date.getFullYear()).slice(-2);
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	const hh = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	return `${yy}${mm}${dd}-${hh}${min}${ss}`;
}

export const actions: Actions = {
	upload: async ({ request }) => {
		const formData = await request.formData();
		const dataStr = formData.get('data');

		if (!dataStr || typeof dataStr !== 'string') {
			return fail(400, { error: 'Missing form data' });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(dataStr);
		} catch {
			return fail(400, { error: 'Invalid JSON file' });
		}

		const result = validateProgramUpload(parsed);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}

		const programName = `Uploaded Program ${formatTimestamp(new Date())}`;
		const program = createProgram(db, programName);

		for (const day of result.data.days) {
			const newDay = addWorkoutDay(db, program.id, day.name);
			for (const ex of day.exercises) {
				addDayExercise(db, newDay.id, ex.name, ex.sets ?? 3);
			}
		}

		throw redirect(302, `/programs/${program.id}`);
	}
};
