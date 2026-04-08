import { AppSidebar } from '#/components/app-sidebar'
import { Separator } from '#/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import type { SessionUser } from '#/lib/auth'
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: SessionUser | null }).user
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

// Map route pathnames to human-readable breadcrumb labels
const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/admin': 'Manage Receptionists',
  '/checkin': 'Check In Visitor',
  '/checkout': 'Check Out Visitor',
  '/visitors': 'Visitor Log',
  '/analytics': 'Analytics',
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as {
    user: (SessionUser & { role?: string | null }) | null
  }
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const pageTitle = BREADCRUMB_MAP[pathname] ?? 'Dashboard'

  return (
    <SidebarProvider>
      <AppSidebar user={user ?? null} />
      <SidebarInset>
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-foreground">
            {pageTitle}
          </span>
        </header>

        {/* ── Page content ─────────────────────────────────────────────── */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
