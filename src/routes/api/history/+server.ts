import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getSessionsByDate } from '$lib/server/db/queries/history';

export const GET: RequestHandler = async ({ url }) => {
	const page = Number(url.searchParams.get('page') ?? '1');
	const limit = Number(url.searchParams.get('limit') ?? '20');

	const result = getSessionsByDate(db, page, limit);
	return json(result);
};
