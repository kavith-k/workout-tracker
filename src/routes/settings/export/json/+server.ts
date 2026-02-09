import { db } from '$lib/server/db';
import { exportAsJSON } from '$lib/server/db/queries/export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const data = exportAsJSON(db);
	const json = JSON.stringify(data, null, 2);

	return new Response(json, {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': 'attachment; filename="workout-tracker-export.json"'
		}
	});
};
