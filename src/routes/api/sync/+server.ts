import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	updateSetLog,
	skipExercise,
	unskipExercise,
	completeWorkout,
	addAdhocExercise,
	addSetToExerciseLog,
	removeSetFromExerciseLog,
	updateExerciseUnitPreference
} from '$lib/server/db/queries/workouts';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, payload } = body;

	try {
		switch (action) {
			case 'UPDATE_SET': {
				const data: { weight?: number | null; reps?: number | null; unit?: 'kg' | 'lbs' } = {};
				if (payload.weight !== undefined) data.weight = payload.weight;
				if (payload.reps !== undefined) data.reps = payload.reps;
				if (payload.unit) data.unit = payload.unit;
				updateSetLog(db, payload.setLogId, data);
				if (payload.unit && payload.exerciseId) {
					updateExerciseUnitPreference(db, payload.exerciseId, payload.unit);
				}
				break;
			}
			case 'SKIP_EXERCISE':
				skipExercise(db, payload.exerciseLogId);
				break;
			case 'UNSKIP_EXERCISE':
				unskipExercise(db, payload.exerciseLogId);
				break;
			case 'COMPLETE_WORKOUT':
				completeWorkout(db, payload.sessionId);
				break;
			case 'ADD_ADHOC':
				addAdhocExercise(db, payload.sessionId, payload.exerciseName);
				break;
			case 'ADD_SET':
				addSetToExerciseLog(db, payload.exerciseLogId);
				break;
			case 'REMOVE_SET':
				removeSetFromExerciseLog(db, payload.setLogId);
				break;
			case 'UPDATE_UNIT':
				updateExerciseUnitPreference(db, payload.exerciseId, payload.unit);
				break;
			default:
				return json({ success: false, error: 'Unknown action' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ success: false, error: message }, { status: 500 });
	}
};
