import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import type { SessionUser } from '#/lib/auth'
import { getAdminAnalyticsFn } from '#/lib/visitors'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Activity, ClipboardList, TrendingUp, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export const Route = createFileRoute('/_authenticated/analytics/')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: SessionUser | null }).user
    if (user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AnalyticsPage,
})

// ─── Accent reuse from dashboard ──────────────────────────────────────────────
const accentColors = {
  teal: {
    bg: 'bg-[rgba(79,184,178,0.1)]',
    text: 'text-[var(--lagoon-deep,#328f97)]',
  },
  green: {
    bg: 'bg-[rgba(47,160,100,0.1)]',
    text: 'text-[var(--palm,#2f6a4a)]',
  },
  blue: {
    bg: 'bg-[rgba(59,130,246,0.1)]',
    text: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-[rgba(245,158,11,0.1)]',
    text: 'text-amber-600 dark:text-amber-400',
  },
} as const

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

// ─── Chart configs ────────────────────────────────────────────────────────────
const trendConfig = {
  checkins: { label: 'Check-ins', color: 'rgb(20, 184, 166)' },
  checkouts: { label: 'Check-outs', color: 'rgb(99, 102, 241)' },
}

const PIE_COLORS = [
  'rgb(20, 184, 166)',
  'rgb(99, 102, 241)',
  'rgb(245, 158, 11)',
  'rgb(168, 85, 247)',
  'rgb(34, 197, 94)',
]

// ─── Component ────────────────────────────────────────────────────────────────
function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => getAdminAnalyticsFn(),
    staleTime: 5 * 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Loading analytics…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Admin
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          30-day visitor and receptionist activity overview.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="size-5" />}
          label="Today's Check-ins"
          value={String(data.todayCheckins)}
          sub="Since midnight"
          accent="teal"
        />
        <StatCard
          icon={<ClipboardList className="size-5" />}
          label="Total Visits"
          value={data.totalCheckins.toLocaleString()}
          sub="All time"
          accent="blue"
        />
        <StatCard
          icon={<Users className="size-5" />}
          label="Currently On Site"
          value={String(data.currentlyOnSite)}
          sub="Not yet checked out"
          accent="green"
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Unique Visitors"
          value={data.uniqueVisitors.toLocaleString()}
          sub="All time"
          accent="amber"
        />
      </div>

      {/* Row 2: Bar chart + Pie chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 30-day daily bar */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">30-Day Daily Activity</h3>
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
                interval={4}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="checkins"
                fill="rgb(20, 184, 166)"
                name="Check-ins"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="checkouts"
                fill="rgb(99, 102, 241)"
                name="Check-outs"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Purpose pie */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold mb-4">
            Visit Purpose Breakdown
          </h3>
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <PieChart>
              <Pie
                data={data.purposeBreakdown}
                dataKey="value"
                nameKey="purpose"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(p) =>
                  `${p.name ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.purposeBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [String(v ?? ''), 'Visits']} />
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      {/* Row 3: Line chart + Receptionist stats horizontal bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 30-day line trend */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">30-Day Trend</h3>
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
                interval={4}
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
        </div>

        {/* Per-receptionist stats */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">
            Receptionist Performance (30 days)
          </h3>
          {data.receptionistStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">
              No data yet.
            </p>
          ) : (
            <ChartContainer config={trendConfig} className="h-56 w-full">
              <BarChart
                data={data.receptionistStats}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={90}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="checkins"
                  fill="rgb(20, 184, 166)"
                  name="Check-ins"
                  radius={[0, 3, 3, 0]}
                />
                <Bar
                  dataKey="checkouts"
                  fill="rgb(99, 102, 241)"
                  name="Check-outs"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* Row 4: Hourly pattern */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Hourly Activity Pattern</h3>
        <ChartContainer config={trendConfig} className="h-44 w-full">
          <BarChart data={data.hourlyPattern}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [String(v ?? ''), 'Check-ins']} />
            <Bar
              dataKey="count"
              fill="rgb(245, 158, 11)"
              name="Check-ins"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )
}
