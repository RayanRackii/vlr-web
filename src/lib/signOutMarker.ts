/** Persistent sign-out barrier for the staff auth storage. Never stores credentials. */
const MARKER_KEY = "rolvix:signed-out-sessions"
const AUTH_STORAGE_KEY = /^sb-.+-auth-token$/

let signingOut = false

function readMarker(): boolean {
  try {
    const raw = window.sessionStorage.getItem(MARKER_KEY)
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    // Migrate the old value tombstones without retaining their session JSON.
    if (Array.isArray(parsed)) return parsed.length > 0
    return typeof parsed === "object" && parsed !== null &&
      "signingOut" in parsed && parsed.signingOut === true
  } catch {
    return false
  }
}

function writeMarker(): void {
  try {
    if (signingOut) {
      window.sessionStorage.setItem(MARKER_KEY, JSON.stringify({ signingOut: true, at: Date.now() }))
    } else {
      window.sessionStorage.removeItem(MARKER_KEY)
    }
  } catch {
    // sessionStorage unavailable: the in-memory flag still guards this page.
  }
}

/** Removes the given keys now and blocks staff auth writes until an explicit login. */
export function removeSessionKeysAsSignedOut(keys: string[]): void {
  signingOut = true
  writeMarker()
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }
}

/** Removes any stored staff session while the sign-out barrier is active. */
export function purgeSignedOutSessions(): boolean {
  if (!isSigningOut()) return false
  let purged = false
  try {
    const storage = window.localStorage
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (key && AUTH_STORAGE_KEY.test(key)) {
        storage.removeItem(key)
        purged = true
      }
    }
  } catch {
    // Storage unavailable.
  }
  return purged
}

/** True from Sair until an explicit staff login, including across reloads. */
export function isSigningOut(): boolean {
  return signingOut || readMarker()
}

/** Supabase uses this adapter so even an already-running refresh cannot save new tokens. */
export const staffAuthStorage = {
  getItem(key: string): string | null {
    if (AUTH_STORAGE_KEY.test(key) && isSigningOut()) {
      window.localStorage.removeItem(key)
      return null
    }
    return window.localStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (AUTH_STORAGE_KEY.test(key) && isSigningOut()) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key)
  },
}

/** Called before an explicit login can write its session. */
export function noteSignInStarted(): void {
  signingOut = false
  writeMarker()
}

export function resetSignOutMarkerForTests(): void {
  noteSignInStarted()
}

if (typeof window !== "undefined") {
  signingOut = readMarker()
  writeMarker()
  purgeSignedOutSessions()
}
