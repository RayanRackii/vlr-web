import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/tenantPortal/lib/customerSessionIdentity", () => ({
  currentCustomerSessionIdentity: () => "customer-1",
}))

import {
  AGENDA_SELECTION_NOTICE_TTL_MS,
  readAgendaSelectionNotice,
  showAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"

describe("agenda selection notice", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("shows a fresh notice", () => {
    showAgendaSelectionNotice("acme", "expired")
    expect(readAgendaSelectionNotice("acme")).toBe("expired")
  })

  it("drops a notice from an earlier visit", () => {
    showAgendaSelectionNotice("acme", "expired")
    vi.setSystemTime(Date.now() + AGENDA_SELECTION_NOTICE_TTL_MS + 1)
    expect(readAgendaSelectionNotice("acme")).toBeNull()
  })

  it("ignores a stored notice without a timestamp", () => {
    window.sessionStorage.setItem(
      "rolvix.portal.agenda-selection-notice.acme",
      JSON.stringify({ customerIdentity: "customer-1", notice: "expired" }),
    )
    expect(readAgendaSelectionNotice("acme")).toBeNull()
  })
})
