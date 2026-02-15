/**
 * Generates 2 years of realistic workout data for testing.
 * Destroys the existing database and rebuilds it with migrations before seeding.
 *
 * Usage: node scripts/seed-test-data.mjs
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dbPath = join(root, 'data', 'workout-tracker.db');

// -- Step 1: Delete existing database --

if (existsSync(dbPath)) {
	unlinkSync(dbPath);
	console.log('Deleted existing database.');
} else {
	console.log('No existing database found.');
}

// -- Step 2: Run migrations to recreate schema --

console.log('Running migrations...');
execSync('npm run db:migrate', { cwd: root, stdio: 'inherit' });

// -- Step 3: Seed data --

const Database = (await import('better-sqlite3')).default;
const db = new Database(dbPath);

// Exercises
const exerciseRows = [
	['Bench Press', 'kg'],
	['Overhead Press', 'kg'],
	['Incline Dumbbell Press', 'kg'],
	['Lateral Raise', 'kg'],
	['Tricep Dips', 'kg'],
	['Squat', 'kg'],
	['Deadlift', 'kg'],
	['Barbell Row', 'kg'],
	['Pull Up', 'kg'],
	['Romanian Deadlift', 'kg'],
	['Leg Press', 'kg'],
	['Face Pull', 'kg']
];

const insertExercise = db.prepare(
	`INSERT INTO exercises (name, unit_preference, created_at) VALUES (?, ?, ?)`
);
const epoch = Math.floor(new Date('2024-01-15').getTime() / 1000);

const exerciseIds = {};
for (const [name, unit] of exerciseRows) {
	const result = insertExercise.run(name, unit, epoch);
	exerciseIds[name] = Number(result.lastInsertRowid);
}
console.log(`Inserted ${exerciseRows.length} exercises.`);

// Programme
const programResult = db
	.prepare(`INSERT INTO programs (name, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)`)
	.run('Push Pull Legs', epoch, epoch);
const programId = Number(programResult.lastInsertRowid);

// Workout days and day-exercise mappings
const dayTemplates = [
	{
		name: 'Push',
		exercises: [
			{ name: 'Bench Press', baseWeight: 60, maxWeight: 95, sets: 4 },
			{ name: 'Overhead Press', baseWeight: 35, maxWeight: 55, sets: 3 },
			{ name: 'Incline Dumbbell Press', baseWeight: 20, maxWeight: 34, sets: 3 },
			{ name: 'Lateral Raise', baseWeight: 8, maxWeight: 14, sets: 3 },
			{ name: 'Tricep Dips', baseWeight: 0, maxWeight: 20, sets: 3 }
		]
	},
	{
		name: 'Pull',
		exercises: [
			{ name: 'Deadlift', baseWeight: 80, maxWeight: 140, sets: 3 },
			{ name: 'Barbell Row', baseWeight: 50, maxWeight: 80, sets: 4 },
			{ name: 'Pull Up', baseWeight: 0, maxWeight: 15, sets: 3 },
			{ name: 'Face Pull', baseWeight: 10, maxWeight: 20, sets: 3 }
		]
	},
	{
		name: 'Legs',
		exercises: [
			{ name: 'Squat', baseWeight: 60, maxWeight: 110, sets: 4 },
			{ name: 'Leg Press', baseWeight: 100, maxWeight: 200, sets: 3 },
			{ name: 'Romanian Deadlift', baseWeight: 50, maxWeight: 90, sets: 3 }
		]
	}
];

const insertDay = db.prepare(
	`INSERT INTO workout_days (program_id, name, sort_order, created_at) VALUES (?, ?, ?, ?)`
);
const insertDayExercise = db.prepare(
	`INSERT INTO day_exercises (workout_day_id, exercise_id, sets_count, sort_order, created_at)
	 VALUES (?, ?, ?, ?, ?)`
);

for (let i = 0; i < dayTemplates.length; i++) {
	const t = dayTemplates[i];
	const dayResult = insertDay.run(programId, t.name, i, epoch);
	const dayId = Number(dayResult.lastInsertRowid);
	for (let j = 0; j < t.exercises.length; j++) {
		const ex = t.exercises[j];
		insertDayExercise.run(dayId, exerciseIds[ex.name], ex.sets, j, epoch);
	}
}
console.log('Created programme with Push/Pull/Legs days.');

// -- Generate sessions from Feb 2024 to Feb 2026 --

const startDate = new Date('2024-02-01');
const endDate = new Date('2026-02-10');
const sessions = [];

let current = new Date(startDate);
let dayIndex = 0;

while (current < endDate) {
	// 0-2 rest days between sessions
	const skip = Math.floor(Math.random() * 3);
	current.setDate(current.getDate() + 1 + skip);

	if (current >= endDate) break;

	// ~6% chance of skipping a whole week (holiday, illness)
	if (Math.random() < 0.06) {
		current.setDate(current.getDate() + 7);
		continue;
	}

	// ~10% chance of skipping a single session (busy day)
	if (Math.random() < 0.1) continue;

	const day = dayTemplates[dayIndex % 3];
	dayIndex++;

	sessions.push({ date: new Date(current), day });
}

const insertSession = db.prepare(
	`INSERT INTO workout_sessions (program_id, program_name, day_name, status, started_at, completed_at)
	 VALUES (?, ?, ?, 'completed', ?, ?)`
);
const insertLog = db.prepare(
	`INSERT INTO exercise_logs (exercise_id, session_id, exercise_name, status, is_adhoc, sort_order, created_at)
	 VALUES (?, ?, ?, ?, 0, ?, ?)`
);
const insertSet = db.prepare(
	`INSERT INTO set_logs (exercise_log_id, set_number, weight, reps, unit, created_at)
	 VALUES (?, ?, ?, ?, 'kg', ?)`
);

const txn = db.transaction(() => {
	for (let i = 0; i < sessions.length; i++) {
		const s = sessions[i];
		const progress = i / sessions.length;

		// Session start: morning, ~07:00-09:59
		const startTime = new Date(s.date);
		startTime.setHours(7 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60));
		const endTime = new Date(startTime);
		endTime.setMinutes(endTime.getMinutes() + 45 + Math.floor(Math.random() * 30));

		const startTs = Math.floor(startTime.getTime() / 1000);
		const endTs = Math.floor(endTime.getTime() / 1000);

		const sessionResult = insertSession.run(
			programId,
			'Push Pull Legs',
			s.day.name,
			startTs,
			endTs
		);
		const sessionId = Number(sessionResult.lastInsertRowid);

		for (let j = 0; j < s.day.exercises.length; j++) {
			const ex = s.day.exercises[j];

			// ~8% chance of skipping an exercise
			const skipped = Math.random() < 0.08;
			const status = skipped ? 'skipped' : 'logged';

			const logResult = insertLog.run(exerciseIds[ex.name], sessionId, ex.name, status, j, startTs);
			const logId = Number(logResult.lastInsertRowid);

			if (!skipped) {
				const weightRange = ex.maxWeight - ex.baseWeight;
				const currentWeight = ex.baseWeight + weightRange * progress;
				const noise = 1 + (Math.random() - 0.5) * 0.1;

				for (let setNum = 1; setNum <= ex.sets; setNum++) {
					let weight = Math.round((currentWeight * noise) / 2.5) * 2.5;
					if (weight < 0) weight = 0;

					const baseReps = ex.name === 'Deadlift' ? 5 : ex.name === 'Pull Up' ? 8 : 10;
					let reps = baseReps + Math.floor(Math.random() * 3) - (setNum > 2 ? 1 : 0);
					if (reps < 3) reps = 3;

					insertSet.run(logId, setNum, weight, reps, startTs);
				}
			}
		}
	}
});

txn();

const sessionCount = db
	.prepare("SELECT COUNT(*) as c FROM workout_sessions WHERE status='completed'")
	.get();
const setCount = db.prepare('SELECT COUNT(*) as c FROM set_logs').get();

console.log(`\nSeeded ${sessionCount.c} completed sessions with ${setCount.c} set logs.`);
console.log('Done.');

db.close();
