import { db } from '#/db/index'
import { user } from '#/db/schema/auth'
import { checkins, visitors } from '#/db/schema/visitors'
import { auth } from '#/lib/auth'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireSession() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const checkInSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  purpose: z.string().min(1),
  host: z.string().min(1),
  department: z.string().optional(),
  notes: z.string().optional(),
})

const checkOutSchema = z.object({ checkinId: z.number() })

const logFiltersSchema = z.object({
  name: z.string().optional(),
  receptionistId: z.string().optional(),
  status: z.enum(['all', 'on_site', 'departed']).default('all'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
})

type CheckInInput = z.infer<typeof checkInSchema>
type CheckOutInput = z.infer<typeof checkOutSchema>
type LogFilters = z.infer<typeof logFiltersSchema>

// ─── Check-in ─────────────────────────────────────────────────────────────────

export const checkInVisitorFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckInInput) => checkInSchema.parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireSession()

    const [visitor] = await db
      .insert(visitors)
      .values({
        fullName: data.fullName,
        phone: data.phone ?? null,
        purpose: data.purpose,
        host: data.host,
        department: data.department ?? null,
      })
      .returning()

    const [checkin] = await db
      .insert(checkins)
      .values({
        visitorId: visitor.id,
        receptionistId: currentUser.id,
        notes: data.notes ?? null,
      })
      .returning()

    return { visitor, checkin }
  })

// ─── Check-out ────────────────────────────────────────────────────────────────

export const checkOutFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CheckOutInput) => checkOutSchema.parse(data))
  .handler(async ({ data }) => {
    await requireSession()
    const [updated] = await db
      .update(checkins)
      .set({ checkOutAt: new Date() })
      .where(and(eq(checkins.id, data.checkinId), isNull(checkins.checkOutAt)))
      .returning()
    if (!updated) throw new Error('Check-in not found or already checked out')
    return updated
  })

// ─── Active check-ins (for the current receptionist) ─────────────────────────

export const getActiveCheckinsFn = createServerFn().handler(async () => {
  const currentUser = await requireSession()
  return db
    .select({
      checkinId: checkins.id,
      checkInAt: checkins.checkInAt,
      notes: checkins.notes,
      visitorId: visitors.id,
      visitorName: visitors.fullName,
      visitorPhone: visitors.phone,
      purpose: visitors.purpose,
      host: visitors.host,
      department: visitors.department,
    })
    .from(checkins)
    .innerJoin(visitors, eq(checkins.visitorId, visitors.id))
    .where(
      and(
        eq(checkins.receptionistId, currentUser.id),
        isNull(checkins.checkOutAt),
      ),
    )
    .orderBy(desc(checkins.checkInAt))
})

// ─── Paged + filtered visitor log ─────────────────────────────────────────────

export const getVisitorLogPagedFn = createServerFn({ method: 'POST' })
  .inputValidator((data: LogFilters) => logFiltersSchema.parse(data))
  .handler(async ({ data }) => {
    await requireSession()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conds: any[] = []
    if (data.name) conds.push(ilike(visitors.fullName, `%${data.name}%`))
    if (data.receptionistId)
      conds.push(eq(checkins.receptionistId, data.receptionistId))
    if (data.status === 'on_site') conds.push(isNull(checkins.checkOutAt))
    if (data.status === 'departed') conds.push(isNotNull(checkins.checkOutAt))
    if (data.dateFrom)
      conds.push(gte(checkins.checkInAt, new Date(data.dateFrom)))
    if (data.dateTo) {
      const end = new Date(data.dateTo)
      end.setHours(23, 59, 59, 999)
      conds.push(lte(checkins.checkInAt, end))
    }
    const where = conds.length
      ? and(...(conds as [(typeof conds)[0]]))
      : undefined

    const [{ total }] = await db
      .select({ total: count() })
      .from(checkins)
      .innerJoin(visitors, eq(checkins.visitorId, visitors.id))
      .where(where)

    const rows = await db
      .select({
        checkinId: checkins.id,
        checkInAt: checkins.checkInAt,
        checkOutAt: checkins.checkOutAt,
        notes: checkins.notes,
        visitorName: visitors.fullName,
        visitorPhone: visitors.phone,
        purpose: visitors.purpose,
        host: visitors.host,
        department: visitors.department,
        receptionistName: user.name,
      })
      .from(checkins)
      .innerJoin(visitors, eq(checkins.visitorId, visitors.id))
      .leftJoin(user, eq(checkins.receptionistId, user.id))
      .where(where)
      .orderBy(desc(checkins.checkInAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize)

    return {
      rows,
      total: Number(total),
      page: data.page,
      pageSize: data.pageSize,
      totalPages: Math.ceil(Number(total) / data.pageSize),
    }
  })

// ─── Receptionist list (for filter dropdown) ─────────────────────────────────

export const getReceptionistListFn = createServerFn().handler(async () => {
  const currentUser = await requireSession()
  if (currentUser.role !== 'admin') return []
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.role, 'receptionist'))
})

// ─── Delete receptionist ──────────────────────────────────────────────────────

export const deleteReceptionistFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) =>
    z.object({ userId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireSession()
    if (currentUser.role !== 'admin') throw new Error('Forbidden')
    await db.delete(user).where(eq(user.id, data.userId))
  })

// ─── Receptionist dashboard stats ────────────────────────────────────────────

export const getReceptionistStatsFn = createServerFn().handler(async () => {
  const currentUser = await requireSession()
  const start = todayStart()

  const [inToday] = await db
    .select({ val: count() })
    .from(checkins)
    .where(
      and(
        eq(checkins.receptionistId, currentUser.id),
        gte(checkins.checkInAt, start),
      ),
    )
  const [outToday] = await db
    .select({ val: count() })
    .from(checkins)
    .where(
      and(
        eq(checkins.receptionistId, currentUser.id),
        isNotNull(checkins.checkOutAt),
        gte(checkins.checkInAt, start),
      ),
    )
  const [onSite] = await db
    .select({ val: count() })
    .from(checkins)
    .where(
      and(
        eq(checkins.receptionistId, currentUser.id),
        isNull(checkins.checkOutAt),
      ),
    )

  return {
    checkedInToday: Number(inToday?.val ?? 0),
    checkedOutToday: Number(outToday?.val ?? 0),
    currentlyOnSite: Number(onSite?.val ?? 0),
  }
})

// ─── Admin dashboard stats ────────────────────────────────────────────────────

export const getAdminStatsFn = createServerFn().handler(async () => {
  await requireSession()
  const start = todayStart()

  const [inToday] = await db
    .select({ val: count() })
    .from(checkins)
    .where(gte(checkins.checkInAt, start))
  const [total] = await db.select({ val: count() }).from(checkins)

  return {
    checkInsToday: Number(inToday?.val ?? 0),
    totalVisits: Number(total?.val ?? 0),
  }
})

// ─── Dashboard chart data (7-day trend + status pie) ─────────────────────────

export const getDashboardChartsFn = createServerFn().handler(async () => {
  const currentUser = await requireSession()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const isAdmin = currentUser.role === 'admin'
  const scope = isAdmin
    ? gte(checkins.checkInAt, sevenDaysAgo)
    : and(
        eq(checkins.receptionistId, currentUser.id),
        gte(checkins.checkInAt, sevenDaysAgo),
      )
  const onSiteScope = isAdmin
    ? isNull(checkins.checkOutAt)
    : and(
        eq(checkins.receptionistId, currentUser.id),
        isNull(checkins.checkOutAt),
      )
  const departedScope = isAdmin
    ? isNotNull(checkins.checkOutAt)
    : and(
        eq(checkins.receptionistId, currentUser.id),
        isNotNull(checkins.checkOutAt),
      )

  const daily = await db
    .select({
      date: sql<string>`DATE(${checkins.checkInAt})`,
      checkins: count(),
      checkouts: count(checkins.checkOutAt),
    })
    .from(checkins)
    .where(scope)
    .groupBy(sql`DATE(${checkins.checkInAt})`)
    .orderBy(sql`DATE(${checkins.checkInAt})`)

  const [onSite] = await db
    .select({ val: count() })
    .from(checkins)
    .where(onSiteScope)
  const [departed] = await db
    .select({ val: count() })
    .from(checkins)
    .where(departedScope)

  return {
    daily: daily.map((d) => ({
      ...d,
      checkins: Number(d.checkins),
      checkouts: Number(d.checkouts),
    })),
    statusPie: [
      { status: 'on_site', label: 'On Site', value: Number(onSite?.val ?? 0) },
      {
        status: 'departed',
        label: 'Departed',
        value: Number(departed?.val ?? 0),
      },
    ],
  }
})

// ─── Export report data (admin only) ─────────────────────────────────────────

const exportFiltersSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
})

type ExportFilters = z.infer<typeof exportFiltersSchema>

export const getExportDataFn = createServerFn({ method: 'POST' })
  .inputValidator((data: ExportFilters) => exportFiltersSchema.parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireSession()
    if (currentUser.role !== 'admin') throw new Error('Forbidden')

    const from = new Date(data.dateFrom)
    from.setHours(0, 0, 0, 0)
    const to = new Date(data.dateTo)
    to.setHours(23, 59, 59, 999)

    const rows = await db
      .select({
        checkinId: checkins.id,
        checkInAt: checkins.checkInAt,
        checkOutAt: checkins.checkOutAt,
        notes: checkins.notes,
        visitorName: visitors.fullName,
        visitorPhone: visitors.phone,
        purpose: visitors.purpose,
        host: visitors.host,
        department: visitors.department,
        receptionistName: user.name,
      })
      .from(checkins)
      .innerJoin(visitors, eq(checkins.visitorId, visitors.id))
      .leftJoin(user, eq(checkins.receptionistId, user.id))
      .where(and(gte(checkins.checkInAt, from), lte(checkins.checkInAt, to)))
      .orderBy(desc(checkins.checkInAt))

    const totalCheckins = rows.length
    const totalCheckouts = rows.filter((r) => r.checkOutAt !== null).length
    const onSite = totalCheckins - totalCheckouts

    // Per-receptionist summary
    const byRec: Record<string, { checkins: number; checkouts: number }> = {}
    for (const r of rows) {
      const name = r.receptionistName ?? 'Unknown'
      if (!byRec[name]) byRec[name] = { checkins: 0, checkouts: 0 }
      byRec[name].checkins++
      if (r.checkOutAt) byRec[name].checkouts++
    }

    return {
      rows,
      summary: { totalCheckins, totalCheckouts, onSite },
      receptionistSummary: Object.entries(byRec).map(([name, s]) => ({
        name,
        ...s,
      })),
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
    }
  })

// ─── Admin analytics (30-day) ─────────────────────────────────────────────────

export const getAdminAnalyticsFn = createServerFn().handler(async () => {
  const currentUser = await requireSession()
  if (currentUser.role !== 'admin') throw new Error('Forbidden')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const start = todayStart()

  const daily = await db
    .select({
      date: sql<string>`DATE(${checkins.checkInAt})`,
      checkins: count(),
      checkouts: count(checkins.checkOutAt),
    })
    .from(checkins)
    .where(gte(checkins.checkInAt, thirtyDaysAgo))
    .groupBy(sql`DATE(${checkins.checkInAt})`)
    .orderBy(sql`DATE(${checkins.checkInAt})`)

  const purposeBreakdown = await db
    .select({ purpose: visitors.purpose, value: count() })
    .from(checkins)
    .innerJoin(visitors, eq(checkins.visitorId, visitors.id))
    .groupBy(visitors.purpose)
    .orderBy(desc(count()))
    .limit(8)

  const receptionistStats = await db
    .select({
      name: user.name,
      checkins: count(),
      checkouts: count(checkins.checkOutAt),
    })
    .from(checkins)
    .innerJoin(user, eq(checkins.receptionistId, user.id))
    .where(gte(checkins.checkInAt, thirtyDaysAgo))
    .groupBy(user.id, user.name)
    .orderBy(desc(count()))

  const hourlyPattern = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${checkins.checkInAt})::int`,
      count: count(),
    })
    .from(checkins)
    .groupBy(sql`EXTRACT(HOUR FROM ${checkins.checkInAt})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${checkins.checkInAt})`)

  const [todayStat] = await db
    .select({ val: count() })
    .from(checkins)
    .where(gte(checkins.checkInAt, start))
  const [totalStat] = await db.select({ val: count() }).from(checkins)
  const [onSiteStat] = await db
    .select({ val: count() })
    .from(checkins)
    .where(isNull(checkins.checkOutAt))
  const [uniqueStat] = await db.select({ val: count() }).from(visitors)

  return {
    daily: daily.map((d) => ({
      ...d,
      checkins: Number(d.checkins),
      checkouts: Number(d.checkouts),
    })),
    purposeBreakdown: purposeBreakdown.map((p) => ({
      purpose: p.purpose,
      value: Number(p.value),
    })),
    receptionistStats: receptionistStats.map((r) => ({
      name: r.name ?? 'Unknown',
      checkins: Number(r.checkins),
      checkouts: Number(r.checkouts),
    })),
    hourlyPattern: hourlyPattern.map((h) => ({
      hour: Number(h.hour),
      label: `${String(Number(h.hour)).padStart(2, '0')}:00`,
      count: Number(h.count),
    })),
    todayCheckins: Number(todayStat?.val ?? 0),
    totalCheckins: Number(totalStat?.val ?? 0),
    currentlyOnSite: Number(onSiteStat?.val ?? 0),
    uniqueVisitors: Number(uniqueStat?.val ?? 0),
  }
})
