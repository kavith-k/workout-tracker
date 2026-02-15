import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	getWorkoutSession,
	getPrescribedSetCounts,
	updateSetLog,
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

	const prescribedSetCounts = getPrescribedSetCounts(db, sessionId);

	return { session, progressiveOverload, prescribedSetCounts };
};

export const actions: Actions = {
	saveExercise: async ({ request }) => {
		const formData = await request.formData();
		const exerciseLogId = Number(formData.get('exerciseLogId'));
		const exerciseId = Number(formData.get('exerciseId'));
		const setsJson = formData.get('sets');

		if (isNaN(exerciseLogId)) return fail(400, { error: 'Invalid exercise log ID' });
		if (!setsJson || typeof setsJson !== 'string') {
			return fail(400, { error: 'Sets data is required' });
		}

		let sets: Array<{
			setLogId: number;
			weight: number | null;
			reps: number | null;
			unit: 'kg' | 'lbs';
		}>;
		try {
			sets = JSON.parse(setsJson);
		} catch {
			return fail(400, { error: 'Invalid sets JSON' });
		}

		let unit: 'kg' | 'lbs' | undefined;
		for (const set of sets) {
			if (typeof set.setLogId === 'number' && set.setLogId < 0) continue; // skip offline placeholders
			if (
				typeof set.setLogId !== 'number' ||
				!Number.isInteger(set.setLogId) ||
				set.setLogId <= 0
			) {
				return fail(400, { error: 'set setLogId must be a positive integer' });
			}
			updateSetLog(db, set.setLogId, {
				weight: set.weight,
				reps: set.reps,
				unit: set.unit
			});
			unit = set.unit;
		}

		// Update exercise unit preference if we have a valid exerciseId
		if (unit && !isNaN(exerciseId) && exerciseId > 0) {
			updateExerciseUnitPreference(db, exerciseId, unit);
		}
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

		const result = completeWorkout(db, sessionId);
		if ('cancelled' in result && result.cancelled) {
			redirect(303, '/?cancelled=1');
		}
		redirect(303, `/workout/${sessionId}/summary`);
	}
};
