/**
 * Visitor management tables.
 */
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const visitors = pgTable('visitors', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  purpose: text('purpose').notNull(),
  host: text('host').notNull(),
  department: text('department'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const checkins = pgTable('checkins', {
  id: serial('id').primaryKey(),
  visitorId: integer('visitor_id')
    .notNull()
    .references(() => visitors.id),
  receptionistId: text('receptionist_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  checkInAt: timestamp('check_in_at').defaultNow().notNull(),
  checkOutAt: timestamp('check_out_at'),
  notes: text('notes'),
})
