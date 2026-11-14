import { QueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { subscribeCustomerSession } from "@/lib/customerSessionEvents"

/** Services wrap axios errors in their own Error types; the original stays in `cause`. */
function findAxiosError(error: unknown) {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (isAxiosError(current)) return current
    current = current.cause
  }
  return isAxiosError(current) ? current : null
}

/** At most one retry, only for network failures and 5xx. 4xx and local (parse) errors fail at once. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  const axiosError = findAxiosError(error)
  if (!axiosError) return false
  if (axiosError.code === "ERR_CANCELED") return false
  const status = axiosError.response?.status
  return status === undefined || status >= 500
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        refetchOnWindowFocus: true,
        retry: shouldRetryQuery,
      },
      mutations: { retry: 0 },
    },
  })
}

export const queryClient = createQueryClient()

/** Tenant enter/exit/switch, login and logout: drop everything cached for the previous session. */
export function clearQueryCache(): void {
  queryClient.clear()
}

// Customer portal login/logout (same tab or another tab) also starts a new tenant session.
if (typeof window !== "undefined") subscribeCustomerSession(clearQueryCache)
