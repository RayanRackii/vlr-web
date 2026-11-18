import { useEffect, useState } from "react"

/** Current time in ms, refreshed every `intervalMs` from timer callbacks (null on the first render). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const tick = setInterval(() => setNow(Date.now()), intervalMs)
    return () => { clearTimeout(first); clearInterval(tick) }
  }, [intervalMs])
  return now
}
