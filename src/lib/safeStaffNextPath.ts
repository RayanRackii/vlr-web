const BLOCKED_PATH_PREFIXES = [
  "/login",
  "/t/",
  "/invite",
  "/reset-password",
  "/onboarding",
  "/landing",
] as const

export function isSafeStaffNextPath(
  value: string | null | undefined,
): value is string {
  if (!value) {
    return false
  }
  if (value.length > 2048) {
    return false
  }
  if (!value.startsWith("/")) {
    return false
  }
  if (value.startsWith("//")) {
    return false
  }
  if (value.includes("\\") || value.includes("://")) {
    return false
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return false
  }

  const pathname = value.split("?")[0] ?? value
  if (!pathname.startsWith("/") || pathname === "/") {
    return false
  }

  return !BLOCKED_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) {
      return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

export function safeStaffNextPath(
  value: string | null | undefined,
): string | null {
  return isSafeStaffNextPath(value) ? value : null
}

export function staffLoginPath(nextPath: string): string {
  const params = new URLSearchParams()
  params.set("next", nextPath)
  return `/login?${params.toString()}`
}
