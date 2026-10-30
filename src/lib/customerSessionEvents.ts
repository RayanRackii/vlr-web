/** Same-tab storage writes do not emit the browser's storage event. */
const CUSTOMER_SESSION_CHANGED = "rolvix:customer-session-changed"

export function notifyCustomerSessionChanged(): void {
  window.dispatchEvent(new Event(CUSTOMER_SESSION_CHANGED))
}

export function subscribeCustomerSession(listener: () => void): () => void {
  window.addEventListener(CUSTOMER_SESSION_CHANGED, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(CUSTOMER_SESSION_CHANGED, listener)
    window.removeEventListener("storage", listener)
  }
}
