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

function isValidId(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidUnit(value: unknown): value is 'kg' | 'lbs' {
	return value === 'kg' || value === 'lbs';
}

function isValidMeasurement(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function badRequest(error: string) {
	return json({ success: false, error }, { status: 400 });
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, payload } = body;

	try {
		switch (action) {
			case 'UPDATE_SET': {
				if (!isValidId(payload.setLogId)) {
					return badRequest('setLogId must be a positive integer');
				}
				if (payload.weight !== undefined && payload.weight !== null) {
					if (!isValidMeasurement(payload.weight)) {
						return badRequest('weight must be a finite number >= 0');
					}
				}
				if (payload.reps !== undefined && payload.reps !== null) {
					if (!isValidMeasurement(payload.reps)) {
						return badRequest('reps must be a finite number >= 0');
					}
				}
				if (payload.unit !== undefined && payload.unit !== null) {
					if (!isValidUnit(payload.unit)) {
						return badRequest('unit must be kg or lbs');
					}
				}
				if (payload.exerciseId !== undefined && payload.exerciseId !== null) {
					if (!isValidId(payload.exerciseId)) {
						return badRequest('exerciseId must be a positive integer');
					}
				}
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
			case 'SKIP_EXERCISE': {
				if (!isValidId(payload.exerciseLogId)) {
					return badRequest('exerciseLogId must be a positive integer');
				}
				skipExercise(db, payload.exerciseLogId);
				break;
			}
			case 'UNSKIP_EXERCISE': {
				if (!isValidId(payload.exerciseLogId)) {
					return badRequest('exerciseLogId must be a positive integer');
				}
				unskipExercise(db, payload.exerciseLogId);
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
			case 'UPDATE_UNIT': {
				if (!isValidId(payload.exerciseId)) {
					return badRequest('exerciseId must be a positive integer');
				}
				if (!isValidUnit(payload.unit)) {
					return badRequest('unit must be kg or lbs');
				}
				updateExerciseUnitPreference(db, payload.exerciseId, payload.unit);
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
