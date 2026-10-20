import { currentCustomerSessionIdentity } from "@/features/tenantPortal/lib/customerSessionIdentity"

export type AgendaSelectionNotice = "expired" | "unavailable"

const STORAGE_PREFIX = "rolvix.portal.agenda-selection-notice"
const NOTICE_EVENT = "rolvix:portal-agenda-selection-notice"

type StoredAgendaSelectionNotice = {
  customerIdentity: string
  notice: AgendaSelectionNotice
}

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
  if (!value) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null
  }
  const record = parsed as Partial<StoredAgendaSelectionNotice>
  const identity = currentCustomerSessionIdentity()
  if (
    (record.notice !== "expired" && record.notice !== "unavailable")
    || typeof record.customerIdentity !== "string"
    || record.customerIdentity !== identity
  ) {
    return null
  }
  return record.notice
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

  const customerIdentity = currentCustomerSessionIdentity()
  if (customerIdentity === null) {
    return
  }

  const value: StoredAgendaSelectionNotice = { customerIdentity, notice }
  window.sessionStorage.setItem(storageKey(subdomain), JSON.stringify(value))
  notifyNoticeChange()
}

export function clearAgendaSelectionNotice(subdomain: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(storageKey(subdomain))
  notifyNoticeChange()
}

/** A notice describes an abandoned selection, never a newly authenticated customer. */
export function clearAgendaSelectionNotices(): void {
  if (typeof window === "undefined") {
    return
  }

  const keys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
    window.sessionStorage.key(index),
  )
  let changed = false
  for (const key of keys) {
    if (key?.startsWith(`${STORAGE_PREFIX}.`)) {
      window.sessionStorage.removeItem(key)
      changed = true
    }
  }
  if (changed) {
    notifyNoticeChange()
  }
}

export function subscribeAgendaSelectionNotice(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(NOTICE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(NOTICE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}
