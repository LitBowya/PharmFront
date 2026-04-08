import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import type { SessionUser } from '#/lib/auth'
import {
  checkInVisitorFn,
  checkOutFn,
  getReceptionistListFn,
  getVisitorLogPagedFn,
} from '#/lib/visitors'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { LogOut, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_authenticated/visitors/')({
  component: VisitorsPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface FormState {
  fullName: string
  phone: string
  purpose: string
  host: string
  department: string
  notes: string
}
const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  purpose: '',
  host: '',
  department: '',
  notes: '',
}

type Status = 'all' | 'on_site' | 'departed'

type VisitorRow = {
  checkinId: number
  visitorName: string
  visitorPhone: string | null
  purpose: string
  host: string
  department: string | null
  checkInAt: string | Date
  checkOutAt: string | Date | null
  receptionistName?: string | null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function VisitorsPage() {
  const { user } = Route.useRouteContext() as {
    user: (SessionUser & { role?: string | null }) | null
  }
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  // ── Check-in dialog ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null)

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await checkInVisitorFn({
        data: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          purpose: form.purpose.trim(),
          host: form.host.trim(),
          department: form.department.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      })
      setLastCheckedIn(form.fullName.trim())
      setForm(EMPTY_FORM)
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['visitor-log-paged'] })
      await queryClient.invalidateQueries({ queryKey: ['receptionist-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Check out ────────────────────────────────────────────────────────────────
  const [checkingOut, setCheckingOut] = useState<number | null>(null)

  async function handleCheckOut(checkinId: number) {
    setCheckingOut(checkinId)
    try {
      await checkOutFn({ data: { checkinId } })
      await queryClient.invalidateQueries({ queryKey: ['visitor-log-paged'] })
      await queryClient.invalidateQueries({ queryKey: ['receptionist-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } finally {
      setCheckingOut(null)
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [nameFilter, setNameFilter] = useState('')
  const [receptionistId, setReceptionistId] = useState('all')
  const [status, setStatus] = useState<Status>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    setPage(1)
  }, [nameFilter, receptionistId, status, dateFrom, dateTo])

  const isMyOnly = !isAdmin && receptionistId === user?.id

  const hasFilters =
    nameFilter ||
    receptionistId !== 'all' ||
    status !== 'all' ||
    dateFrom ||
    dateTo

  function clearFilters() {
    setNameFilter('')
    setReceptionistId('all')
    setStatus('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  function toggleMyOnly() {
    setReceptionistId(isMyOnly ? 'all' : (user?.id ?? 'all'))
    setPage(1)
  }

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: receptionistList = [] } = useQuery({
    queryKey: ['receptionist-list'],
    queryFn: () => getReceptionistListFn(),
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'visitor-log-paged',
      nameFilter,
      receptionistId,
      status,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () =>
      getVisitorLogPagedFn({
        data: {
          name: nameFilter || undefined,
          receptionistId: receptionistId !== 'all' ? receptionistId : undefined,
          status,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
  })

  const rows: VisitorRow[] = (data?.rows ?? []) as VisitorRow[]
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  // ── TanStack Table ────────────────────────────────────────────────────────────
  const columns: ColumnDef<VisitorRow>[] = [
    {
      id: 'visitor',
      header: 'Visitor',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.visitorName}</p>
          {row.original.visitorPhone && (
            <p className="text-xs text-muted-foreground">
              {row.original.visitorPhone}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'purpose',
      header: 'Purpose',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'host',
      header: 'Host / Dept',
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-muted-foreground">{row.original.host}</p>
          {row.original.department && (
            <p className="text-xs text-muted-foreground/60">
              {row.original.department}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'checkInAt',
      header: 'Checked In',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {fmt(getValue() as string | Date)}
        </span>
      ),
    },
    {
      accessorKey: 'checkOutAt',
      header: 'Checked Out',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {fmt(getValue() as string | Date | null)}
        </span>
      ),
    },
    ...(isAdmin
      ? ([
          {
            id: 'receptionist',
            header: 'Receptionist',
            cell: ({ row }: { row: { original: VisitorRow } }) => (
              <span className="text-sm text-muted-foreground">
                {row.original.receptionistName ?? '—'}
              </span>
            ),
          },
        ] as ColumnDef<VisitorRow>[])
      : []),
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.checkOutAt ? (
          <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Departed
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-[rgba(99,102,241,0.12)] text-[rgb(99,102,241)]">
            On Site
          </span>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.checkOutAt ? null : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={() => void handleCheckOut(row.original.checkinId)}
            disabled={checkingOut === row.original.checkinId}
          >
            <LogOut className="size-3" />
            {checkingOut === row.original.checkinId ? '…' : 'Check Out'}
          </Button>
        ),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: { pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: page - 1, pageSize: PAGE_SIZE })
          : updater
      setPage(next.pageIndex + 1)
    },
  })

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Visitors
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Visitor Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Check in visitors, track arrivals, and record departures.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1 shrink-0">
          {isFetching && !isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Refreshing…
            </span>
          )}
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Check In Visitor
          </Button>
        </div>
      </div>

      {/* Success toast */}
      {lastCheckedIn && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border bg-[rgba(20,184,166,0.08)] border-[rgba(20,184,166,0.3)] px-4 py-3 text-sm text-[rgb(13,148,136)]"
          role="status"
        >
          <span>
            <strong>{lastCheckedIn}</strong> checked in successfully.
          </span>
          <button
            onClick={() => setLastCheckedIn(null)}
            className="opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 mb-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search visitor name…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="on_site">On Site</SelectItem>
              <SelectItem value="departed">Departed</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!isAdmin && (
            <button
              onClick={toggleMyOnly}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isMyOnly
                  ? 'bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-[rgb(99,102,241)]'
                  : 'border-input text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {isMyOnly ? 'My check-ins only' : 'My check-ins only'}
            </button>
          )}
          {isAdmin && (
            <div className="w-60">
              <Select value={receptionistId} onValueChange={setReceptionistId}>
                <SelectTrigger>
                  <SelectValue placeholder="All receptionists" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All receptionists</SelectItem>
                  {receptionistList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-20 text-center text-sm text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-20 text-center text-sm text-muted-foreground"
                  >
                    {hasFilters
                      ? 'No records match the current filters.'
                      : 'No visitors yet. Use "Check In Visitor" to get started.'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-card hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && rows.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t bg-muted/20 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} &middot; {total.toLocaleString()}{' '}
              record{total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage() || isFetching}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage() || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Check-in dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setDialogOpen(open)
            if (!open) {
              setForm(EMPTY_FORM)
              setFormError(null)
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check In Visitor</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCheckIn} className="space-y-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ci-fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ci-fullName"
                  placeholder="e.g. Amara Tesfaye"
                  required
                  disabled={submitting}
                  {...field('fullName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci-phone">Phone Number</Label>
                <Input
                  id="ci-phone"
                  type="tel"
                  placeholder="e.g. +251 91 234 5678"
                  disabled={submitting}
                  {...field('phone')}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ci-host">Person to Visit</Label>
                <Input
                  id="ci-host"
                  placeholder="e.g. Dr. Kebede"
                  disabled={submitting}
                  {...field('host')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci-dept">Department</Label>
                <Input
                  id="ci-dept"
                  placeholder="e.g. Finance"
                  disabled={submitting}
                  {...field('department')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ci-purpose">
                Purpose of Visit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-purpose"
                placeholder="e.g. Meeting, Delivery, Interview…"
                required
                disabled={submitting}
                {...field('purpose')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ci-notes">Notes</Label>
              <Textarea
                id="ci-notes"
                placeholder="Any additional information…"
                rows={2}
                disabled={submitting}
                {...field('notes')}
              />
            </div>

            {formError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Checking in…' : 'Check In'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
