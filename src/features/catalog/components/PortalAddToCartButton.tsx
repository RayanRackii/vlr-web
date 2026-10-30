import { useEffect, useRef, useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PortalAddToCartButton({
  children,
  className,
  disabled,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...props
}: ComponentProps<typeof Button>) {
  const [pressed, setPressed] = useState(false)
  const [ripple, setRipple] = useState<{ id: number; x: number; y: number; size: number } | null>(null)
  const rippleId = useRef(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeout.current !== null) clearTimeout(timeout.current)
  }, [])

  return (
    <Button
      type="button"
      {...props}
      disabled={disabled}
      className={cn("portal-add-to-cart", className)}
      data-pressing={pressed || undefined}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || disabled || event.button > 0) return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
        setPressed(true)
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = Number.isFinite(event.clientX) ? event.clientX - bounds.left : bounds.width / 2
        const y = Number.isFinite(event.clientY) ? event.clientY - bounds.top : bounds.height / 2
        setRipple({ id: ++rippleId.current, x, y, size: Math.hypot(bounds.width, bounds.height) * 2 })
        if (timeout.current !== null) clearTimeout(timeout.current)
        timeout.current = setTimeout(() => {
          setRipple(null)
          timeout.current = null
        }, 550)
      }}
      onPointerUp={(event) => {
        setPressed(false)
        onPointerUp?.(event)
      }}
      onPointerCancel={(event) => {
        setPressed(false)
        onPointerCancel?.(event)
      }}
      onPointerLeave={(event) => {
        setPressed(false)
        onPointerLeave?.(event)
      }}
      onClick={(event) => {
        if (disabled) return
        onClick?.(event)
        if (!event.defaultPrevented) {
          try { navigator.vibrate?.(8) } catch { /* Optional feedback may be unavailable. */ }
        }
      }}
    >
      {children}
      {ripple ? (
        <span
          key={ripple.id}
          className="portal-cart-ripple"
          aria-hidden="true"
          style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
        />
      ) : null}
    </Button>
  )
}
