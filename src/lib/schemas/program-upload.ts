export type ProgramUploadExercise = { name: string; sets?: number };
export type ProgramUploadDay = { name: string; exercises: ProgramUploadExercise[] };
export type ProgramUploadSchema = { days: ProgramUploadDay[] };

type ValidationResult = { ok: true; data: ProgramUploadSchema } | { ok: false; error: string };

export function validateProgramUpload(data: unknown): ValidationResult {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return { ok: false, error: 'Invalid format: expected a JSON object' };
	}

	const obj = data as Record<string, unknown>;

	if (!Array.isArray(obj.days) || obj.days.length === 0) {
		return { ok: false, error: 'Must contain a non-empty "days" array' };
	}

	const days: ProgramUploadDay[] = [];

	for (let i = 0; i < obj.days.length; i++) {
		const day = obj.days[i];
		if (!day || typeof day !== 'object' || Array.isArray(day)) {
			return { ok: false, error: `Day ${i + 1}: must be an object` };
		}

		const dayObj = day as Record<string, unknown>;
		if (typeof dayObj.name !== 'string' || !dayObj.name.trim()) {
			return { ok: false, error: `Day ${i + 1}: must have a non-empty "name"` };
		}

		if (!Array.isArray(dayObj.exercises) || dayObj.exercises.length === 0) {
			return { ok: false, error: `Day ${i + 1}: must have a non-empty "exercises" array` };
		}

		const exercises: ProgramUploadExercise[] = [];
		const seenNames = new Set<string>();

		for (let j = 0; j < dayObj.exercises.length; j++) {
			const ex = dayObj.exercises[j];
			if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
				return { ok: false, error: `Day ${i + 1}, exercise ${j + 1}: must be an object` };
			}

			const exObj = ex as Record<string, unknown>;
			if (typeof exObj.name !== 'string' || !exObj.name.trim()) {
				return {
					ok: false,
					error: `Day ${i + 1}, exercise ${j + 1}: must have a non-empty "name"`
				};
			}

			const trimmedName = exObj.name.trim();
			const lowerName = trimmedName.toLowerCase();

			if (seenNames.has(lowerName)) {
				return {
					ok: false,
					error: `Day ${i + 1}: duplicate exercise "${trimmedName}"`
				};
			}
			seenNames.add(lowerName);

			if (exObj.sets !== undefined) {
				if (typeof exObj.sets !== 'number' || !Number.isInteger(exObj.sets) || exObj.sets < 1) {
					return {
						ok: false,
						error: `Day ${i + 1}, exercise ${j + 1}: "sets" must be a positive integer`
					};
				}
			}

			exercises.push({
				name: trimmedName,
				...(exObj.sets !== undefined ? { sets: exObj.sets as number } : {})
			});
		}

		days.push({ name: dayObj.name.trim(), exercises });
	}

	return { ok: true, data: { days } };
}
