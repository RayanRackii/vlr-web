import type { MouseEvent } from "react"

/** Left click with no modifiers. Ctrl, Cmd, Shift, Alt, and other buttons open elsewhere. */
export function isSameTabPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const target = event.currentTarget.target
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (target === "" || target === "_self")
  )
}
