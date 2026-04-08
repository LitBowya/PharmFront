/**
 * Seed script: creates the initial admin account.
 * Run once after your first migration:
 *   bun run scripts/seed-admin.ts
 *
 * Default credentials (change these before going live):
 *   Login ID : admin
 *   Password : Admin@1234
 */
import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })

import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.ts'
import { user as userTable } from '../src/db/schema.ts'
import { auth } from '../src/lib/auth.ts'

const ADMIN_USERNAME = 'admin'
const ADMIN_NAME = 'System Admin'
const ADMIN_EMAIL = 'admin@receiptionist.local'
const ADMIN_PASSWORD = 'Admin@1234'

async function seed() {
  console.log('Checking for existing admin…')

  const existing = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, ADMIN_USERNAME))
    .limit(1)

  if (existing.length > 0) {
    console.log(
      `Admin account already exists (username: "${ADMIN_USERNAME}"). Nothing to do.`,
    )
    process.exit(0)
  }

  console.log('Creating admin account…')

  // Use Better Auth's internal sign-up API (no HTTP round-trip needed)
  const result = await auth.api.signUpEmail({
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      username: ADMIN_USERNAME,
    },
    asResponse: false,
  })

  if (!result?.user?.id) {
    console.error('Failed to create admin user:', result)
    process.exit(1)
  }

  // Promote to admin role
  await db
    .update(userTable)
    .set({ role: 'admin' })
    .where(eq(userTable.id, result.user.id))

  console.log('✓ Admin account created successfully.')
  console.log(`  Login ID : ${ADMIN_USERNAME}`)
  console.log(`  Password : ${ADMIN_PASSWORD}`)
  console.log('  ⚠  Change the password after your first login.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
