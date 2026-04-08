/**
 * Application domain tables.
 * Add visitor, checkin, etc. here as new tables are built.
 */
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const todos = pgTable('todos', {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
