type ConnectivityListener = () => void

const listeners = new Set<ConnectivityListener>()

function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine
}

let latchedOffline = !browserOnline()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function setLatchedOffline(next: boolean): void {
  if (latchedOffline === next) {
    return
  }

  latchedOffline = next
  emit()
}

function handleOffline(): void {
  setLatchedOffline(true)
}

function handleOnline(): void {
  if (!browserOnline()) {
    setLatchedOffline(true)
    return
  }

  emit()
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", handleOffline)
  window.addEventListener("online", handleOnline)
}

/** Browser reports offline. Ignores the failed-request latch. */
export function readBrowserOffline(): boolean {
  return !browserOnline()
}

/**
 * True only when the browser is online and no failed request is still
 * unresolved. An `online` event by itself does not clear the latch.
 */
export function isEffectivelyOnline(): boolean {
  return browserOnline() && !latchedOffline
}

export function subscribeConnectivity(
  listener: ConnectivityListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A request failed before any HTTP response (tab offline or API unreachable). */
export function noteTransportFailure(): void {
  setLatchedOffline(true)
}

/**
 * Any HTTP response means the server was reached. The latch stays while the
 * browser itself still reports offline.
 */
export function noteTransportSuccess(): void {
  if (!browserOnline()) {
    setLatchedOffline(true)
    return
  }

  setLatchedOffline(false)
}

/** Tests only. Re-reads `navigator.onLine` and drops a stale latch. */
export function resetConnectivityForTests(): void {
  latchedOffline = !browserOnline()
  emit()
}
