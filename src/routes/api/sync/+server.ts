import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	updateSetLog,
	completeWorkout,
	addAdhocExercise,
	addSetToExerciseLog,
	removeSetFromExerciseLog,
	updateExerciseUnitPreference
} from '$lib/server/db/queries/workouts';

function isValidId(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidUnit(value: unknown): value is 'kg' | 'lbs' {
	return value === 'kg' || value === 'lbs';
}

function badRequest(error: string) {
	return json({ success: false, error }, { status: 400 });
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, payload } = body;

	try {
		switch (action) {
			case 'SAVE_EXERCISE': {
				if (!isValidId(payload.exerciseLogId)) {
					return badRequest('exerciseLogId must be a positive integer');
				}
				if (!Array.isArray(payload.sets)) {
					return badRequest('sets must be an array');
				}
				let unit: 'kg' | 'lbs' | undefined;
				for (const set of payload.sets) {
					if (typeof set.setLogId === 'number' && set.setLogId < 0) continue; // skip offline placeholders
					if (!isValidId(set.setLogId)) {
						return badRequest('set setLogId must be a positive integer');
					}
					if (set.unit && !isValidUnit(set.unit)) {
						return badRequest('set unit must be kg or lbs');
					}
					updateSetLog(db, set.setLogId, {
						weight: set.weight ?? null,
						reps: set.reps ?? null,
						unit: set.unit
					});
					unit = set.unit;
				}
				if (unit && payload.exerciseId && isValidId(payload.exerciseId)) {
					updateExerciseUnitPreference(db, payload.exerciseId, unit);
				}
				break;
			}
			case 'COMPLETE_WORKOUT': {
				if (!isValidId(payload.sessionId)) {
					return badRequest('sessionId must be a positive integer');
				}
				completeWorkout(db, payload.sessionId);
				break;
			}
			case 'ADD_ADHOC': {
				if (!isValidId(payload.sessionId)) {
					return badRequest('sessionId must be a positive integer');
				}
				if (typeof payload.exerciseName !== 'string' || !payload.exerciseName.trim()) {
					return badRequest('exerciseName must be a non-empty string');
				}
				addAdhocExercise(db, payload.sessionId, payload.exerciseName.trim());
				break;
			}
			case 'ADD_SET': {
				if (!isValidId(payload.exerciseLogId)) {
					return badRequest('exerciseLogId must be a positive integer');
				}
				addSetToExerciseLog(db, payload.exerciseLogId);
				break;
			}
			case 'REMOVE_SET': {
				if (!isValidId(payload.setLogId)) {
					return badRequest('setLogId must be a positive integer');
				}
				removeSetFromExerciseLog(db, payload.setLogId);
				break;
			}
			default:
				return json({ success: false, error: 'Unknown action' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ success: false, error: message }, { status: 500 });
	}
};
