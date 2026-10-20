import { afterEach, describe, expect, it } from "vitest"

import {
  clearCustomerSession,
  isCustomerSignedInForTenant,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  readAgendaSelectionNotice,
  showAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function customerToken(tenantId: string): string {
  const payload = btoa(JSON.stringify({ tenant_id: tenantId, customer_id: "c1" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
  return `header.${payload}.${"sig"}`
}

describe("customer session tenant binding", () => {
  afterEach(() => {
    clearCustomerSession()
  })

  it("treats a token saved for this subdomain as signed in", () => {
    persistCustomerSession(customerToken(TENANT_A), "FICC", "Ana", "c1", TENANT_A)

    expect(isCustomerSignedInForTenant("ficc")).toBe(true)
    expect(isCustomerSignedInForTenant(" FICC ")).toBe(true)
  })

  it("does not treat another tenant's session as signed in", () => {
    persistCustomerSession(customerToken(TENANT_A), "ficc", "Ana", "c1", TENANT_A)

    expect(isCustomerSignedInForTenant("other-club")).toBe(false)
    expect(isCustomerSignedInForTenant("")).toBe(false)
  })

  it("stays signed out when there is no token", () => {
    window.localStorage.setItem("rolvix.customer.subdomain", "ficc")

    expect(isCustomerSignedInForTenant("ficc")).toBe(false)
  })

  it("rejects a token whose tenant id does not match the saved tenant", () => {
    persistCustomerSession(customerToken(TENANT_B), "ficc", "Ana", "c1", TENANT_A)

    expect(isCustomerSignedInForTenant("ficc")).toBe(false)
  })

  it("keeps an older session that has no saved tenant id", () => {
    persistCustomerSession("legacy-token", "ficc", "Ana")

    expect(isCustomerSignedInForTenant("ficc")).toBe(true)
    expect(isCustomerSignedInForTenant("other-club")).toBe(false)
  })

  it("clears agenda notices when a customer session ends or is replaced", () => {
    persistCustomerSession(customerToken(TENANT_A), "ficc", "Ana", "c1", TENANT_A)
    showAgendaSelectionNotice("ficc", "unavailable")

    clearCustomerSession()
    expect(readAgendaSelectionNotice("ficc")).toBeNull()

    persistCustomerSession(customerToken(TENANT_A), "ficc", "Ana", "c1", TENANT_A)
    showAgendaSelectionNotice("ficc", "expired")
    persistCustomerSession(customerToken(TENANT_A), "ficc", "Bruno", "c2", TENANT_A)

    expect(readAgendaSelectionNotice("ficc")).toBeNull()
  })
})
