import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { role?: string | null } | null }).user
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role === 'admin') {
      throw redirect({ to: '/admin' })
    }
    throw redirect({ to: '/dashboard' })
  },
  component: () => null,
})
