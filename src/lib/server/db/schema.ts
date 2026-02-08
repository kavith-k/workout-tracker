import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const programs = sqliteTable('programs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const workoutDays = sqliteTable('workout_days', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	programId: integer('program_id')
		.notNull()
		.references(() => programs.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const exercises = sqliteTable('exercises', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	unitPreference: text('unit_preference', { enum: ['kg', 'lbs'] })
		.notNull()
		.default('kg'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const dayExercises = sqliteTable('day_exercises', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	workoutDayId: integer('workout_day_id')
		.notNull()
		.references(() => workoutDays.id, { onDelete: 'cascade' }),
	exerciseId: integer('exercise_id')
		.notNull()
		.references(() => exercises.id),
	setsCount: integer('sets_count').notNull().default(3),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const workoutSessions = sqliteTable('workout_sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	programId: integer('program_id').references(() => programs.id, { onDelete: 'set null' }),
	workoutDayId: integer('workout_day_id').references(() => workoutDays.id, {
		onDelete: 'set null'
	}),
	programName: text('program_name').notNull(),
	dayName: text('day_name').notNull(),
	status: text('status', { enum: ['in_progress', 'completed'] })
		.notNull()
		.default('in_progress'),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	completedAt: integer('completed_at', { mode: 'timestamp' })
});

export const exerciseLogs = sqliteTable('exercise_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	exerciseId: integer('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
	sessionId: integer('session_id')
		.notNull()
		.references(() => workoutSessions.id, { onDelete: 'cascade' }),
	exerciseName: text('exercise_name').notNull(),
	status: text('status', { enum: ['logged', 'skipped'] })
		.notNull()
		.default('logged'),
	isAdhoc: integer('is_adhoc', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const setLogs = sqliteTable('set_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	exerciseLogId: integer('exercise_log_id')
		.notNull()
		.references(() => exerciseLogs.id, { onDelete: 'cascade' }),
	setNumber: integer('set_number').notNull(),
	weight: real('weight'),
	reps: integer('reps'),
	unit: text('unit', { enum: ['kg', 'lbs'] })
		.notNull()
		.default('kg'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
