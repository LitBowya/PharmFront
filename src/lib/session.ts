import { auth } from '#/lib/auth'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export const getSessionFn = createServerFn().handler(async () => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  return session
})
