import { reloadPage } from "@/lib/reloadPage"

/**
 * Stale lazy chunks: after a deploy, a tab that stays open asks for a chunk whose hashed file no
 * longer exists. `React.lazy` caches the rejected import, so the only recovery is a page reload.
 */
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [^\s]+ failed/i,
  /loading css chunk [^\s]+ failed/i,
  /unable to preload css/i,
]

const RELOAD_FLAG_KEY = "rolvix.chunkReloadAt"
/** One automatic reload per window; a second chunk error inside it surfaces to the boundary. */
const RELOAD_WINDOW_MS = 30_000

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === "ChunkLoadError") return true
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
}

/**
 * Reloads the page once for a chunk-load error. Returns false (and does nothing) when a reload
 * already happened recently, so a chunk that is really missing cannot cause a reload loop.
 */
export function reloadOnceForChunkError(now: number = Date.now()): boolean {
  try {
    const previous = Number(window.sessionStorage.getItem(RELOAD_FLAG_KEY))
    if (Number.isFinite(previous) && previous > 0 && now - previous < RELOAD_WINDOW_MS) {
      return false
    }
    window.sessionStorage.setItem(RELOAD_FLAG_KEY, String(now))
  } catch {
    // Without sessionStorage the loop guard is unavailable: do not reload automatically.
    return false
  }
  reloadPage()
  return true
}

/** Called after a lazy chunk loaded: the next deploy may reload again. */
export function clearChunkReloadFlag(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_FLAG_KEY)
  } catch {
    // ignore
  }
}
