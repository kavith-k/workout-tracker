import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exportAsCSV } from '$lib/server/db/queries/export';

export const GET: RequestHandler = () => {
	const csv = exportAsCSV(db);

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="workout-tracker-export.csv"'
		}
	});
};
