import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { checkInVisitorFn } from '#/lib/visitors'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/checkin/')({
  component: CheckInPage,
})

interface FormState {
  fullName: string
  phone: string
  purpose: string
  host: string
  department: string
  notes: string
}

const EMPTY: FormState = {
  fullName: '',
  phone: '',
  purpose: '',
  host: '',
  department: '',
  notes: '',
}

function CheckInPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null)

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
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
      setForm(EMPTY)
      // Invalidate stats + active checkins so counts refresh
      await queryClient.invalidateQueries({ queryKey: ['receptionist-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['active-checkins'] })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Visitors
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Check In Visitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the visitor's details to record their arrival.
        </p>
      </div>

      {/* Success banner */}
      {lastCheckedIn && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            <strong>{lastCheckedIn}</strong> checked in successfully.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border bg-card p-6 space-y-5"
      >
        {/* Row 1 */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. Amara Tesfaye"
              required
              disabled={submitting}
              {...field('fullName')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. +251 91 234 5678"
              disabled={submitting}
              {...field('phone')}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host">
              Person to Visit <span className="text-destructive">*</span>
            </Label>
            <Input
              id="host"
              placeholder="e.g. Dr. Kebede"
              required
              disabled={submitting}
              {...field('host')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g. Finance"
              disabled={submitting}
              {...field('department')}
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose">
            Purpose of Visit <span className="text-destructive">*</span>
          </Label>
          <Input
            id="purpose"
            placeholder="e.g. Meeting, Delivery, Interview…"
            required
            disabled={submitting}
            {...field('purpose')}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any additional information…"
            rows={3}
            disabled={submitting}
            {...field('notes')}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Checking in…' : 'Check In Visitor'}
        </Button>
      </form>
    </div>
  )
}
