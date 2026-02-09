import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	getWorkoutSession,
	updateSetLog,
	skipExercise,
	unskipExercise,
	addAdhocExercise,
	addSetToExerciseLog,
	removeSetFromExerciseLog,
	completeWorkout,
	getPreviousPerformance,
	getMaxPerformance,
	updateExerciseUnitPreference
} from '$lib/server/db/queries/workouts';

export const load: PageServerLoad = async ({ params }) => {
	const sessionId = Number(params.sessionId);
	if (isNaN(sessionId)) error(404, 'Invalid session ID');

	const session = getWorkoutSession(db, sessionId);
	if (!session) error(404, 'Workout session not found');

	// Get progressive overload data for each exercise
	const progressiveOverload: Record<
		number,
		{
			previous: { date: Date; sets: Array<{ weight: number; reps: number; unit: string }> } | null;
			max: { weight: number; reps: number; unit: string; date: Date } | null;
		}
	> = {};

	for (const log of session.exerciseLogs) {
		if (log.exerciseId) {
			progressiveOverload[log.id] = {
				previous: getPreviousPerformance(db, log.exerciseId),
				max: getMaxPerformance(db, log.exerciseId)
			};
		}
	}

	return { session, progressiveOverload };
};

export const actions: Actions = {
	updateSet: async ({ request }) => {
		const formData = await request.formData();
		const setLogId = Number(formData.get('setLogId'));
		const weight = formData.get('weight');
		const reps = formData.get('reps');
		const unit = formData.get('unit') as 'kg' | 'lbs' | null;

		if (isNaN(setLogId)) return fail(400, { error: 'Invalid set ID' });

		const data: { weight?: number | null; reps?: number | null; unit?: 'kg' | 'lbs' } = {};
		if (weight !== null) data.weight = weight === '' ? null : Number(weight);
		if (reps !== null) data.reps = reps === '' ? null : Number(reps);
		if (unit) data.unit = unit;

		updateSetLog(db, setLogId, data);

		// Also update exercise unit preference if unit was changed
		if (unit) {
			const exerciseId = Number(formData.get('exerciseId'));
			if (!isNaN(exerciseId) && exerciseId > 0) {
				updateExerciseUnitPreference(db, exerciseId, unit);
			}
		}
	},
	skip: async ({ request }) => {
		const formData = await request.formData();
		const exerciseLogId = Number(formData.get('exerciseLogId'));
		if (isNaN(exerciseLogId)) return fail(400, { error: 'Invalid exercise log ID' });
		skipExercise(db, exerciseLogId);
	},
	unskip: async ({ request }) => {
		const formData = await request.formData();
		const exerciseLogId = Number(formData.get('exerciseLogId'));
		if (isNaN(exerciseLogId)) return fail(400, { error: 'Invalid exercise log ID' });
		unskipExercise(db, exerciseLogId);
	},
	addAdhoc: async ({ request }) => {
		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		const exerciseName = formData.get('exerciseName');

		if (isNaN(sessionId)) return fail(400, { error: 'Invalid session ID' });
		if (!exerciseName || typeof exerciseName !== 'string' || !exerciseName.trim()) {
			return fail(400, { error: 'Exercise name is required' });
		}

		addAdhocExercise(db, sessionId, exerciseName.trim());
	},
	addSet: async ({ request }) => {
		const formData = await request.formData();
		const exerciseLogId = Number(formData.get('exerciseLogId'));
		if (isNaN(exerciseLogId)) return fail(400, { error: 'Invalid exercise log ID' });
		addSetToExerciseLog(db, exerciseLogId);
	},
	removeSet: async ({ request }) => {
		const formData = await request.formData();
		const setLogId = Number(formData.get('setLogId'));
		if (isNaN(setLogId)) return fail(400, { error: 'Invalid set ID' });
		removeSetFromExerciseLog(db, setLogId);
	},
	stop: async ({ request }) => {
		const formData = await request.formData();
		const sessionId = Number(formData.get('sessionId'));
		if (isNaN(sessionId)) return fail(400, { error: 'Invalid session ID' });

		completeWorkout(db, sessionId);
		redirect(303, `/workout/${sessionId}/summary`);
	}
};
