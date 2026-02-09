import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createProgram, addWorkoutDay, addDayExercise } from '$lib/server/db/queries/programs';
import { exercises } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allExercises = db
		.select({ name: exercises.name })
		.from(exercises)
		.orderBy(asc(exercises.name))
		.all();

	return {
		exercises: allExercises.map((e) => e.name)
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const dataStr = formData.get('data');

		if (!dataStr || typeof dataStr !== 'string') {
			return fail(400, { error: 'Missing form data' });
		}

		let parsed: {
			name: string;
			days: Array<{
				name: string;
				exercises: Array<{ exerciseName: string; setsCount: number }>;
			}>;
		};

		try {
			parsed = JSON.parse(dataStr);
		} catch {
			return fail(400, { error: 'Invalid form data' });
		}

		if (!parsed.name?.trim()) {
			return fail(400, { error: 'Program name is required' });
		}

		if (!parsed.days?.length) {
			return fail(400, { error: 'At least one day is required' });
		}

		for (const day of parsed.days) {
			if (!day.name?.trim()) {
				return fail(400, { error: 'All days must have a name' });
			}
		}

		const program = createProgram(db, parsed.name.trim());

		for (const day of parsed.days) {
			const newDay = addWorkoutDay(db, program.id, day.name.trim());
			for (const ex of day.exercises) {
				addDayExercise(db, newDay.id, ex.exerciseName.trim(), ex.setsCount);
			}
		}

		throw redirect(302, '/programs');
	}
};
