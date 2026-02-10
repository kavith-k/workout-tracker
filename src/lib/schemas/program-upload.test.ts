import { describe, it, expect } from 'vitest';
import { validateProgramUpload } from './program-upload';

describe('validateProgramUpload', () => {
	describe('valid inputs', () => {
		it('accepts minimal valid input', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat' }] }]
			});
			expect(result).toEqual({
				ok: true,
				data: { days: [{ name: 'Day 1', exercises: [{ name: 'Squat' }] }] }
			});
		});

		it('accepts exercises with explicit sets', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: 5 }] }]
			});
			expect(result).toEqual({
				ok: true,
				data: { days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: 5 }] }] }
			});
		});

		it('accepts multi-day programmes', () => {
			const result = validateProgramUpload({
				days: [
					{ name: 'Upper', exercises: [{ name: 'Bench Press', sets: 3 }] },
					{ name: 'Lower', exercises: [{ name: 'Squat', sets: 4 }] }
				]
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.data.days).toHaveLength(2);
			}
		});

		it('trims exercise and day names', () => {
			const result = validateProgramUpload({
				days: [{ name: '  Day 1  ', exercises: [{ name: '  Squat  ' }] }]
			});
			expect(result).toEqual({
				ok: true,
				data: { days: [{ name: 'Day 1', exercises: [{ name: 'Squat' }] }] }
			});
		});

		it('allows same exercise name across different days', () => {
			const result = validateProgramUpload({
				days: [
					{ name: 'Day 1', exercises: [{ name: 'Squat' }] },
					{ name: 'Day 2', exercises: [{ name: 'Squat' }] }
				]
			});
			expect(result.ok).toBe(true);
		});
	});

	describe('invalid inputs', () => {
		it('rejects null', () => {
			const result = validateProgramUpload(null);
			expect(result).toEqual({ ok: false, error: 'Invalid format: expected a JSON object' });
		});

		it('rejects non-object', () => {
			expect(validateProgramUpload('string').ok).toBe(false);
			expect(validateProgramUpload(42).ok).toBe(false);
			expect(validateProgramUpload([]).ok).toBe(false);
		});

		it('rejects missing days', () => {
			const result = validateProgramUpload({});
			expect(result).toEqual({ ok: false, error: 'Must contain a non-empty "days" array' });
		});

		it('rejects empty days array', () => {
			const result = validateProgramUpload({ days: [] });
			expect(result).toEqual({ ok: false, error: 'Must contain a non-empty "days" array' });
		});

		it('rejects day without name', () => {
			const result = validateProgramUpload({
				days: [{ exercises: [{ name: 'Squat' }] }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('Day 1');
		});

		it('rejects day with empty name', () => {
			const result = validateProgramUpload({
				days: [{ name: '   ', exercises: [{ name: 'Squat' }] }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('Day 1');
		});

		it('rejects day without exercises', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('Day 1');
		});

		it('rejects day with empty exercises array', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [] }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('Day 1');
		});

		it('rejects exercise without name', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{}] }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('exercise 1');
		});

		it('rejects exercise with empty name', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: '' }] }]
			});
			expect(result.ok).toBe(false);
		});

		it('rejects sets of zero', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: 0 }] }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('positive integer');
		});

		it('rejects negative sets', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: -1 }] }]
			});
			expect(result.ok).toBe(false);
		});

		it('rejects non-integer sets', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: 2.5 }] }]
			});
			expect(result.ok).toBe(false);
		});

		it('rejects string sets', () => {
			const result = validateProgramUpload({
				days: [{ name: 'Day 1', exercises: [{ name: 'Squat', sets: '3' }] }]
			});
			expect(result.ok).toBe(false);
		});

		it('rejects duplicate exercise names within same day (case-insensitive)', () => {
			const result = validateProgramUpload({
				days: [
					{
						name: 'Day 1',
						exercises: [{ name: 'Squat' }, { name: 'squat' }]
					}
				]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain('duplicate');
		});
	});
});
