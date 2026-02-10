import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exportAsJSON } from '$lib/server/db/queries/export';

export const GET: RequestHandler = () => {
	const data = exportAsJSON(db);
	const json = JSON.stringify(data, null, 2);

	return new Response(json, {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': 'attachment; filename="workout-tracker-export.json"'
		}
	});
};
