import { db } from '#/db/index'
import * as schema from '#/db/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : [],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    // Required so Better Auth's internal API can create users.
    // There is no public sign-up page — all accounts are created by the admin.
    enabled: true,
  },
  plugins: [
    username(),
    admin({ defaultRole: 'receptionist' }),
    tanstackStartCookies(),
  ],
})

export type SessionUser = typeof auth.$Infer.Session.user
