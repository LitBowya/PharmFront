import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import { authClient } from '#/lib/auth-client'
import {
  getAdminStatsFn,
  getDashboardChartsFn,
  getReceptionistStatsFn,
} from '#/lib/visitors'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Activity,
  ClipboardList,
  LogIn,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type User = { name?: string; role?: string | null } | undefined

// ─── Root ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { user: ctxUser } = Route.useRouteContext() as { user: User }
  const user = ctxUser
  const isAdmin = user?.role === 'admin'

  return isAdmin ? (
    <AdminOverview user={user} />
  ) : (
    <ReceptionistOverview user={user} />
  )
}

// ─── Admin overview ───────────────────────────────────────────────────────────

function AdminOverview({ user }: { user: User }) {
  const router = useRouter()

  const { data: receptionistCount } = useQuery({
    queryKey: ['receptionist-count'],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          filterField: 'role',
          filterValue: 'receptionist',
          filterOperator: 'eq',
        },
      })
      return res.data?.users.length ?? 0
    },
    staleTime: 5 * 60_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStatsFn(),
    staleTime: 60_000,
  })

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => getDashboardChartsFn(),
    staleTime: 5 * 60_000,
  })

  const chartConfig = {
    checkins: { label: 'Check-ins', color: 'rgb(20, 184, 166)' },
    checkouts: { label: 'Check-outs', color: 'rgb(99, 102, 241)' },
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Admin Panel
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage receptionists and monitor visitor activity from here.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <StatCard
          icon={<Users className="size-5" />}
          label="Receptionists"
          value={
            receptionistCount === undefined ? '…' : String(receptionistCount)
          }
          sub="Active accounts"
          accent="teal"
        />
        <StatCard
          icon={<Activity className="size-5" />}
          label="Check-ins today"
          value={stats === undefined ? '…' : String(stats.checkInsToday)}
          sub="Across all receptionists"
          accent="green"
        />
        <StatCard
          icon={<ClipboardList className="size-5" />}
          label="Total visits"
          value={stats === undefined ? '…' : String(stats.totalVisits)}
          sub="All time"
          accent="blue"
        />
      </div>

      <h2 className="text-sm font-semibold mb-3">Quick actions</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickCard
          icon={<Users className="size-6" />}
          title="Manage Receptionists"
          description="Create accounts, view the list, or ban / unban existing receptionists."
          accent="teal"
          actionLabel="Open"
          onAction={() => void router.navigate({ to: '/admin' })}
        />
        <QuickCard
          icon={<ClipboardList className="size-6" />}
          title="Visitor Log"
          description="Full visitor history across all receptionists — today and past days."
          accent="blue"
          actionLabel="Open"
          onAction={() => void router.navigate({ to: '/visitors' })}
        />
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 7-day trend */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">7-Day Activity Trend</h3>
          {chartsLoading ? (
            <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
          ) : charts ? (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <LineChart data={charts.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="checkins"
                  stroke="rgb(20, 184, 166)"
                  strokeWidth={2}
                  dot={false}
                  name="Check-ins"
                />
                <Line
                  type="monotone"
                  dataKey="checkouts"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth={2}
                  dot={false}
                  name="Check-outs"
                />
              </LineChart>
            </ChartContainer>
          ) : null}
        </div>

        {/* Status pie */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Visitor Status</h3>
          {chartsLoading ? (
            <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
          ) : charts ? (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <PieChart>
                <Pie
                  data={charts.statusPie}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={(p) =>
                    `${p.name ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {charts.statusPie.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? 'rgb(20, 184, 166)' : 'rgb(99, 102, 241)'}
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Receptionist overview ────────────────────────────────────────────────────

function ReceptionistOverview({ user }: { user: User }) {
  const router = useRouter()

  const { data: stats } = useQuery({
    queryKey: ['receptionist-stats'],
    queryFn: () => getReceptionistStatsFn(),
    staleTime: 60_000,
  })

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => getDashboardChartsFn(),
    staleTime: 5 * 60_000,
  })

  const chartConfig = {
    checkins: { label: 'Check-ins', color: 'rgb(20, 184, 166)' },
    checkouts: { label: 'Check-outs', color: 'rgb(99, 102, 241)' },
  }

  return (
    <div className="">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Receptionist Dashboard
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the actions below to manage visitor check-ins and check-outs.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <StatCard
          icon={<LogIn className="size-5" />}
          label="Checked in today"
          value={stats === undefined ? '…' : String(stats.checkedInToday)}
          sub="Your check-ins"
          accent="teal"
        />
        <StatCard
          icon={<LogOut className="size-5" />}
          label="Checked out today"
          value={stats === undefined ? '…' : String(stats.checkedOutToday)}
          sub="Your check-outs"
          accent="green"
        />
        <StatCard
          icon={<ShieldCheck className="size-5" />}
          label="Currently on site"
          value={stats === undefined ? '…' : String(stats.currentlyOnSite)}
          sub="Still checked in"
          accent="blue"
        />
      </div>

      <h2 className="text-sm font-semibold mb-3">Quick actions</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickCard
          icon={<LogIn className="size-6" />}
          title="Check In / Out"
          description="Record visitor arrivals and departures in one place."
          accent="teal"
          actionLabel="Open"
          onAction={() => void router.navigate({ to: '/visitors' })}
        />
        <QuickCard
          icon={<ClipboardList className="size-6" />}
          title="Visitor Log"
          description="View all visitor records for today and past days."
          accent="blue"
          actionLabel="Open"
          onAction={() => void router.navigate({ to: '/visitors' })}
        />
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">7-Day Activity Trend</h3>
          {chartsLoading ? (
            <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
          ) : charts ? (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <LineChart data={charts.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="checkins"
                  stroke="rgb(20, 184, 166)"
                  strokeWidth={2}
                  dot={false}
                  name="Check-ins"
                />
                <Line
                  type="monotone"
                  dataKey="checkouts"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth={2}
                  dot={false}
                  name="Check-outs"
                />
              </LineChart>
            </ChartContainer>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Visitor Status</h3>
          {chartsLoading ? (
            <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
          ) : charts ? (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <PieChart>
                <Pie
                  data={charts.statusPie}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={(p) =>
                    `${p.name ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {charts.statusPie.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? 'rgb(20, 184, 166)' : 'rgb(99, 102, 241)'}
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

const accentColors = {
  teal: {
    bg: 'bg-[rgba(79,184,178,0.1)]',
    text: 'text-[var(--lagoon-deep,#328f97)]',
    btn: 'bg-[rgba(79,184,178,0.15)] hover:bg-[rgba(79,184,178,0.25)] text-[var(--lagoon-deep,#328f97)]',
  },
  green: {
    bg: 'bg-[rgba(47,160,100,0.1)]',
    text: 'text-[var(--palm,#2f6a4a)]',
    btn: 'bg-[rgba(47,160,100,0.12)] hover:bg-[rgba(47,160,100,0.22)] text-[var(--palm,#2f6a4a)]',
  },
  blue: {
    bg: 'bg-[rgba(59,130,246,0.1)]',
    text: 'text-blue-600 dark:text-blue-400',
    btn: 'bg-[rgba(59,130,246,0.12)] hover:bg-[rgba(59,130,246,0.22)] text-blue-600 dark:text-blue-400',
  },
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: keyof typeof accentColors
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  const c = accentColors[accent]
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div
        className={`size-10 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground/70">{sub}</p>
      </div>
    </div>
  )
}

interface QuickCardProps {
  icon: React.ReactNode
  title: string
  description: string
  accent: keyof typeof accentColors
  actionLabel: string
  onAction?: () => void
  disabled?: boolean
}

function QuickCard({
  icon,
  title,
  description,
  accent,
  actionLabel,
  onAction,
  disabled,
}: QuickCardProps) {
  const c = accentColors[accent]
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <div
        className={`size-11 rounded-xl flex items-center justify-center ${c.bg} ${c.text}`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm leading-tight">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`self-start text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
            : c.btn
        }`}
      >
        {actionLabel}
      </button>
    </div>
  )
}
