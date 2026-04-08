import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { checkOutFn, getActiveCheckinsFn } from '#/lib/visitors'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck, LogOut, Search, User } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/checkout/')({
  component: CheckOutPage,
})

function formatDuration(checkInAt: string | Date) {
  const ms = Date.now() - new Date(checkInAt).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`
}

function CheckOutPage() {
  const queryClient = useQueryClient()
  const [checkingOut, setCheckingOut] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const {
    data: activeCheckins = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['active-checkins'],
    queryFn: () => getActiveCheckinsFn(),
    staleTime: 60_000, // 1 min
  })

  async function handleCheckOut(checkinId: number, visitorName: string) {
    setError(null)
    setCheckingOut(checkinId)
    try {
      await checkOutFn({ data: { checkinId } })
      await queryClient.invalidateQueries({ queryKey: ['active-checkins'] })
      await queryClient.invalidateQueries({ queryKey: ['receptionist-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['visitor-log'] })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to check out ${visitorName}.`,
      )
    } finally {
      setCheckingOut(null)
    }
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Visitors
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Check Out Visitor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a visitor currently on site to record their departure.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0 mt-1"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Name search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search visitor name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Loading active visitors…
        </div>
      ) : activeCheckins.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <ClipboardCheck className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No visitors currently on site.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activeCheckins
            .filter((c) =>
              c.visitorName.toLowerCase().includes(search.toLowerCase()),
            )
            .map((c) => (
              <li
                key={c.checkinId}
                className="flex items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="size-10 rounded-full bg-[rgba(79,184,178,0.15)] text-(--lagoon-deep,#328f97) flex items-center justify-center shrink-0">
                    <User className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {c.visitorName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.purpose} · {c.host}
                      {c.department ? ` · ${c.department}` : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      Checked in {formatDuration(c.checkInAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleCheckOut(c.checkinId, c.visitorName)
                  }
                  disabled={checkingOut === c.checkinId}
                  className="shrink-0 gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  {checkingOut === c.checkinId ? 'Checking out…' : 'Check Out'}
                </Button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
