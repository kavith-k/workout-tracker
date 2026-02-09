import { db } from '$lib/server/db';
import { exportAsCSV } from '$lib/server/db/queries/export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const csv = exportAsCSV(db);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="workout-tracker-export.csv"'
		}
	});
};
