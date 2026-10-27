/**
 * Sign-out tombstone. Must stay free of imports: main.tsx evaluates it before the
 * Supabase client so a reload during "Sair" cannot restore the session that was just ended.
 *
 * Sair removes the session keys from localStorage synchronously and records the removed
 * key/value pairs here (in memory and in sessionStorage). Any late write of the SAME value
 * (an in-flight refresh or a lock-held save in the auth client) is undone, both while the
 * page lives and on the next boot. A new login writes a different value and is never touched.
 */

const MARKER_KEY = "rolvix:signed-out-sessions"

type RemovedEntry = { key: string; value: string }

let signingOut = false
let removed: RemovedEntry[] = []

function readMarker(): RemovedEntry[] {
  try {
    const raw = window.sessionStorage.getItem(MARKER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RemovedEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RemovedEntry).key === "string" &&
        typeof (entry as RemovedEntry).value === "string",
    )
  } catch {
    return []
  }
}

function writeMarker(entries: RemovedEntry[]): void {
  try {
    if (entries.length === 0) {
      window.sessionStorage.removeItem(MARKER_KEY)
    } else {
      window.sessionStorage.setItem(MARKER_KEY, JSON.stringify(entries))
    }
  } catch {
    // sessionStorage unavailable: the in-memory list still guards this page.
  }
}

/** Removes the given localStorage keys now and remembers their values as signed out. */
export function removeSessionKeysAsSignedOut(keys: string[]): void {
  signingOut = true
  const known = new Map(readMarker().concat(removed).map((entry) => [entry.key + "\u0000" + entry.value, entry]))
  for (const key of keys) {
    try {
      const value = window.localStorage.getItem(key)
      if (value !== null) {
        known.set(key + "\u0000" + value, { key, value })
      }
      window.localStorage.removeItem(key)
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }
  removed = [...known.values()]
  writeMarker(removed)
}

/** Undoes any re-write of a signed-out session value. Returns true if something was removed. */
export function purgeSignedOutSessions(): boolean {
  const entries = removed.length > 0 ? removed : readMarker()
  let purged = false
  for (const { key, value } of entries) {
    try {
      if (window.localStorage.getItem(key) === value) {
        window.localStorage.removeItem(key)
        purged = true
      }
    } catch {
      // ignore
    }
  }
  return purged
}

/** True between the start of Sair and the next login on this page. */
export function isSigningOut(): boolean {
  return signingOut
}

/** Called when a new login starts on this page. Old tombstones stay (they only match old values). */
export function noteSignInStarted(): void {
  signingOut = false
}

export function resetSignOutMarkerForTests(): void {
  signingOut = false
  removed = []
  try {
    window.sessionStorage.removeItem(MARKER_KEY)
  } catch {
    // ignore
  }
}

// Boot: a reload during or after Sair must not restore the ended session.
if (typeof window !== "undefined") {
  purgeSignedOutSessions()
}
