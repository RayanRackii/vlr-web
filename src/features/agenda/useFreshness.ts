import { useEffect, useState } from "react"

/**
 * Clock for the agenda: `now` ticks every `intervalMs`; `updatedAt` is the time a load last finished
 * (null until the first one). Both are set from timer callbacks, never during render.
 */
export function useFreshness(loading: boolean, intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const tick = setInterval(() => setNow(Date.now()), intervalMs)
    return () => { clearTimeout(first); clearInterval(tick) }
  }, [intervalMs])
  useEffect(() => {
    if (loading) return
    const done = setTimeout(() => { const stamp = Date.now(); setUpdatedAt(stamp); setNow((current) => Math.max(current ?? 0, stamp)) }, 0)
    return () => clearTimeout(done)
  }, [loading])
  return { now, updatedAt }
}
