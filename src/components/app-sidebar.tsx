import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '#/components/ui/sidebar'
import { authClient } from '#/lib/auth-client'
import { useRouter } from '@tanstack/react-router'
import {
  BarChart2,
  ChevronUp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react'

// ─── Nav definitions per role ─────────────────────────────────────────────────

const ADMIN_NAV = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    to: '/dashboard',
    badge: null,
  },
  {
    label: 'Receptionists',
    icon: Users,
    to: '/admin',
    badge: null,
  },
  {
    label: 'Visitor Log',
    icon: ClipboardList,
    to: '/visitors',
    badge: null,
  },
  {
    label: 'Analytics',
    icon: BarChart2,
    to: '/analytics',
    badge: null,
  },
] as const

const RECEPTIONIST_NAV = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    to: '/dashboard',
    badge: null,
  },
  {
    label: 'Visitors',
    icon: ClipboardList,
    to: '/visitors',
    badge: null,
  },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  user: { name: string; role?: string | null } | null
}

export function AppSidebar({ user }: AppSidebarProps) {
  const router = useRouter()
  const isAdmin = user?.role === 'admin'
  const navItems = isAdmin ? ADMIN_NAV : RECEPTIONIST_NAV
  const roleLabel = isAdmin ? 'Admin' : 'Receptionist'

  async function handleSignOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <Sidebar collapsible="icon">
      {/* ── Header: brand ─────────────────────────────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default select-none hover:bg-transparent active:bg-transparent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[rgba(79,184,178,0.18)] border border-[rgba(79,184,178,0.3)] text-(--lagoon-deep,#328f97)">
                <ClipboardList className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-sm">PharmFront</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {roleLabel} Panel
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content: nav ──────────────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isDisabled = ('disabled' in item &&
                  !!item.disabled) as boolean
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild={!isDisabled}
                      tooltip={item.label}
                      disabled={isDisabled}
                      className={
                        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                      }
                      onClick={
                        isDisabled
                          ? undefined
                          : () => void router.navigate({ to: item.to })
                      }
                    >
                      {isDisabled ? (
                        <span className="flex items-center gap-2">
                          <Icon />
                          <span>{item.label}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Icon />
                          <span>{item.label}</span>
                        </span>
                      )}
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="text-[9px] opacity-60">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: user + sign out ────────────────────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs bg-[rgba(79,184,178,0.18)] text-(--lagoon-deep,#328f97)">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground capitalize">
                      {roleLabel}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs bg-[rgba(79,184,178,0.18)] text-(--lagoon-deep,#328f97)">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
