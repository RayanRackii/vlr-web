export const STAFF_HOME_REDIRECT = "dashboard-unavailable" as const

export function staffHomeRedirectState(): {
  staffHomeRedirect: typeof STAFF_HOME_REDIRECT
} {
  return { staffHomeRedirect: STAFF_HOME_REDIRECT }
}

export function isStaffHomeRedirect(state: unknown): boolean {
  if (!state || typeof state !== "object") {
    return false
  }

  return (
    (state as { staffHomeRedirect?: unknown }).staffHomeRedirect ===
    STAFF_HOME_REDIRECT
  )
}
