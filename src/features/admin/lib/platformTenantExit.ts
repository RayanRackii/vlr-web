const EXITED_USER_KEY = "rolvix.platformTenantExitedUserId"
const EXITED_EVENT = "rolvix:platform-tenant-exited"

export function readPlatformTenantExitedUserId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(EXITED_USER_KEY)
  return value && value.trim().length > 0 ? value : null
}

export function writePlatformTenantExitedUserId(userId: string | null) {
  if (typeof window === "undefined") {
    return
  }

  const trimmed = userId?.trim() ?? ""
  if (trimmed.length === 0) {
    window.sessionStorage.removeItem(EXITED_USER_KEY)
  } else {
    window.sessionStorage.setItem(EXITED_USER_KEY, trimmed)
  }

  window.dispatchEvent(new Event(EXITED_EVENT))
}

export function subscribePlatformTenantExit(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(EXITED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(EXITED_EVENT, onStoreChange)
  }
}
