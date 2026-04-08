import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { SessionUser } from '#/lib/auth'
import { authClient } from '#/lib/auth-client'
import { deleteReceptionistFn } from '#/lib/visitors'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/admin/')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: SessionUser | null }).user
    if (user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

interface Receptionist {
  id: string
  name: string
  username?: string | null
  email: string
  createdAt: string | Date
  banned?: boolean | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

function AdminPage() {
  const queryClient = useQueryClient()

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function field(key: 'name' | 'username' | 'password') {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      const username = form.username.trim().toLowerCase()
      const res = await authClient.admin.createUser({
        name: form.name.trim(),
        email: `${username}@pharmfront.local`,
        password: form.password,
        role: 'receptionist' as 'user',
        data: { username },
      } as Parameters<typeof authClient.admin.createUser>[0])
      if (res.error) {
        setFormError(res.error.message ?? 'Failed to create account.')
      } else {
        setFormSuccess(`"${form.name.trim()}" added. Login ID: ${username}`)
        setForm({ name: '', username: '', password: '' })
        setDialogOpen(false)
        await queryClient.invalidateQueries({ queryKey: ['receptionists'] })
      }
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Receptionist | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteReceptionistFn({ data: { userId: deleteTarget.id } })
      await queryClient.invalidateQueries({ queryKey: ['receptionists'] })
      setDeleteTarget(null)
    } catch {
      setDeleteError('Failed to delete. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Ban / Unban ───────────────────────────────────────────────────────────
  const [toggling, setToggling] = useState<string | null>(null)

  async function handleBanToggle(r: Receptionist) {
    setToggling(r.id)
    try {
      if (r.banned) {
        await authClient.admin.unbanUser({ userId: r.id })
      } else {
        await authClient.admin.banUser({ userId: r.id })
      }
      await queryClient.invalidateQueries({ queryKey: ['receptionists'] })
    } finally {
      setToggling(null)
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: receptionists = [], isFetching } = useQuery({
    queryKey: ['receptionists'],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          filterField: 'role',
          filterValue: 'receptionist',
          filterOperator: 'eq',
        },
      })
      return (res.data?.users ?? []) as Receptionist[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // ── TanStack Table ────────────────────────────────────────────────────────
  const columns: ColumnDef<Receptionist>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
        </div>
      ),
    },
    {
      id: 'loginId',
      header: 'Login ID',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono">
          {row.original.username ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.banned ? (
          <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-[rgba(217,119,6,0.12)] text-[rgb(217,119,6)]">
            Suspended
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-[rgba(20,184,166,0.12)] text-[rgb(13,148,136)]">
            Active
          </span>
        ),
    },
    {
      id: 'createdAt',
      header: 'Added',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {fmtDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => handleBanToggle(row.original)}
            disabled={toggling === row.original.id}
          >
            {toggling === row.original.id
              ? '…'
              : row.original.banned
                ? 'Unban'
                : 'Ban'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5"
            onClick={() => {
              setDeleteTarget(row.original)
              setDeleteError(null)
            }}
            disabled={deleting && deleteTarget?.id === row.original.id}
          >
            {deleting && deleteTarget?.id === row.original.id ? (
              '…'
            ) : (
              <Trash2 className="size-3" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: receptionists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Admin
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Receptionist Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage receptionist accounts — add, suspend, or remove access.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1 shrink-0">
          {isFetching && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Refreshing…
            </span>
          )}
          <Button
            onClick={() => {
              setDialogOpen(true)
              setFormError(null)
              setFormSuccess(null)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            Add Receptionist
          </Button>
        </div>
      </div>

      {/* Success toast */}
      {formSuccess && (
        <div className="mb-4 rounded-xl border bg-[rgba(20,184,166,0.08)] border-[rgba(20,184,166,0.3)] px-4 py-3 text-sm text-[rgb(13,148,136)]">
          {formSuccess}
        </div>
      )}

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
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap last:text-right"
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
              {isFetching && receptionists.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-20 text-center text-sm text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : receptionists.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-20 text-center text-sm text-muted-foreground"
                  >
                    No receptionists yet. Use "Add Receptionist" to create one.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-card hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 last:text-right">
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
      </div>

      {/* Add Receptionist Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setDialogOpen(open)
            if (!open) {
              setForm({ name: '', username: '', password: '' })
              setFormError(null)
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Receptionist</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="r-name">Full Name</Label>
              <Input
                id="r-name"
                placeholder="e.g. Amara Tesfaye"
                required
                disabled={creating}
                {...field('name')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-username">Login ID</Label>
              <Input
                id="r-username"
                placeholder="e.g. amara01"
                required
                disabled={creating}
                autoComplete="off"
                {...field('username')}
              />
              <p className="text-[11px] text-muted-foreground">
                Letters, numbers, and underscores only — this is what the
                receptionist enters to sign in.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-password">Password</Label>
              <Input
                id="r-password"
                type="password"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                disabled={creating}
                autoComplete="new-password"
                {...field('password')}
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
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={creating}>
                {creating ? 'Creating…' : 'Create Receptionist'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Receptionist</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteTarget?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
