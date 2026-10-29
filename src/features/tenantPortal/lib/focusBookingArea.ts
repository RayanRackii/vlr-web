export function focusBookingArea() {
  const heading = document.getElementById("portal-booking-heading")
  if (!heading) return

  heading.focus({ preventScroll: true })
  heading.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  })
}
