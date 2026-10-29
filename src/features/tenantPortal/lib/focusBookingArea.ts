export function focusBookingArea() {
  const spaces = document.getElementById("portal-booking-spaces")
  if (!spaces) return
  const target = spaces.querySelector<HTMLElement>(
    'button:not(:disabled):not([aria-disabled="true"]), [role="button"][tabindex="0"]:not([aria-disabled="true"]), select:not(:disabled), input:not(:disabled):not([type="hidden"])',
  ) ?? spaces

  target.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  })
  target.focus({ preventScroll: true })
}
