export type AgendaSelectionNotice = "expired" | "unavailable"

const STORAGE_PREFIX = "rolvix.portal.agenda-selection-notice"
const NOTICE_EVENT = "rolvix:portal-agenda-selection-notice"

function storageKey(subdomain: string): string {
  return `${STORAGE_PREFIX}.${subdomain.trim().toLowerCase()}`
}

export function readAgendaSelectionNotice(
  subdomain: string,
): AgendaSelectionNotice | null {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(storageKey(subdomain))
  return value === "expired" || value === "unavailable" ? value : null
}

function notifyNoticeChange() {
  window.dispatchEvent(new Event(NOTICE_EVENT))
}

export function showAgendaSelectionNotice(
  subdomain: string,
  notice: AgendaSelectionNotice,
): void {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(storageKey(subdomain), notice)
  notifyNoticeChange()
}

export function clearAgendaSelectionNotice(subdomain: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(storageKey(subdomain))
  notifyNoticeChange()
}

export function subscribeAgendaSelectionNotice(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(NOTICE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(NOTICE_EVENT, onStoreChange)
  }
}
