import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"

const SHOW_DELAY_MS = 250
const MIN_VISIBLE_MS = 350

/**
 * Thin top progress bar for React Router navigations.
 * Appears only after ~250ms so instant route swaps do not flash.
 */
export function TopProgressBar() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    let showTimer = 0
    let hideTimer = 0
    let shownAt = 0
    let cancelled = false

    setVisible(false)
    setActive(false)

    showTimer = window.setTimeout(() => {
      if (cancelled) {
        return
      }
      shownAt = Date.now()
      setVisible(true)
      setActive(true)
    }, SHOW_DELAY_MS)

    // Complete shortly after paint; keep bar visible briefly if it appeared late.
    hideTimer = window.setTimeout(() => {
      if (cancelled) {
        return
      }
      const elapsed = shownAt > 0 ? Date.now() - shownAt : 0
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
      window.setTimeout(() => {
        if (!cancelled) {
          setActive(false)
          window.setTimeout(() => {
            if (!cancelled) {
              setVisible(false)
            }
          }, 200)
        }
      }, wait)
    }, SHOW_DELAY_MS + 120)

    return () => {
      cancelled = true
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [location.key])

  if (!visible) {
    return null
  }

  return (
    <div
      role="progressbar"
      aria-hidden={!active}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className={cn(
          "h-full w-full origin-left bg-primary transition-transform duration-200 ease-out",
          active ? "scale-x-100 animate-[top-progress_0.9s_ease-out_forwards]" : "scale-x-0",
        )}
      />
    </div>
  )
}
