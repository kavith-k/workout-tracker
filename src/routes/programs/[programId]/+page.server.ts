import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	getProgram,
	updateProgram,
	addWorkoutDay,
	addDayExercise,
	removeWorkoutDay
} from '$lib/server/db/queries/programs';
import { exercises } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const programId = Number(params.programId);
	if (isNaN(programId)) {
		throw error(400, 'Invalid program ID');
	}

	const program = getProgram(db, programId);
	if (!program) {
		throw redirect(302, '/programs');
	}

	const allExercises = db
		.select({ name: exercises.name })
		.from(exercises)
		.orderBy(asc(exercises.name))
		.all();

	return {
		program,
		exercises: allExercises.map((e) => e.name)
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
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

		const programId = Number(params.programId);
		const program = getProgram(db, programId);
		if (!program) {
			return fail(404, { error: 'Program not found' });
		}

		// Update program name
		updateProgram(db, programId, { name: parsed.name.trim() });

		// Delete all existing days (cascades to exercises)
		for (const day of program.days) {
			removeWorkoutDay(db, day.id);
		}

		// Re-create days and exercises from form data
		for (const day of parsed.days) {
			const newDay = addWorkoutDay(db, programId, day.name.trim());
			for (const ex of day.exercises) {
				addDayExercise(db, newDay.id, ex.exerciseName.trim(), ex.setsCount);
			}
		}

		throw redirect(302, '/programs');
	}
};
