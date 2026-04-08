import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: unknown }).user
    if (user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authClient.signIn.username({
        username: username.trim(),
        password,
      })
      if (res.error) {
        setError(res.error.message ?? 'Invalid credentials. Please try again.')
      } else {
        window.location.href = '/'
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--background,#f8fafc) px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[rgba(79,184,178,0.15)] border border-[rgba(79,184,178,0.3)] mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 text-(--lagoon-deep,#1a8a8a)"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-(--sea-ink,#1a2e35)">
            PharmFront
          </h1>
          <p className="mt-1 text-sm text-(--sea-ink-soft,#4a6572)">
            Sign in to your account
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-[rgba(23,58,64,0.1)] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Login ID
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your login ID"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
