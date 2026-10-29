import { afterEach, describe, expect, it, vi } from "vitest"

import { customerApi } from "@/lib/api"

import {
  clearCustomerSession,
  getCustomerLabel,
  isCustomerSignedInForTenant,
  persistCustomerSession,
  setCustomerLabel,
  updateCustomerProfile,
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
    vi.restoreAllMocks()
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

  it("clears a previous customer's label when the next session has none", () => {
    persistCustomerSession("token-a", "portal", "Ana")
    persistCustomerSession("token-b", "portal")
    expect(getCustomerLabel()).toBeNull()
  })

  it("uses a trimmed email only when the profile name is blank", () => {
    setCustomerLabel("   ", "  ana@example.test  ")
    expect(getCustomerLabel()).toBe("ana@example.test")
    setCustomerLabel("  Ana Silva  ", "ana@example.test")
    expect(getCustomerLabel()).toBe("Ana Silva")
    setCustomerLabel("  ", null)
    expect(getCustomerLabel()).toBeNull()
  })

  it.each(["unchanged", "logout", "replacement"])("only syncs a successful profile update to its originating session (%s)", async (session) => {
    persistCustomerSession("token", "portal", "Ana Silva")
    let finish = () => {}
    const pending = new Promise<void>((resolve) => { finish = resolve })
    vi.spyOn(customerApi, "patch").mockImplementation(async () => {
      await pending
      return { data: {
      id: "11111111-1111-4111-8111-111111111111", tenantId: TENANT_A,
      name: "  Beatriz Souza  ", email: "ana@example.test",
      phone: null, customerType: "Individual", document: null, cpf: null,
      postalCode: null, addressStreet: null, addressNeighborhood: null,
      addressCity: null, addressState: null, photoUrl: null,
      createdAt: "2026-10-29T12:00:00.000Z", phoneVerified: false,
      } }
    })
    const request = updateCustomerProfile({ name: "Beatriz Souza" })
    if (session === "logout") clearCustomerSession()
    if (session === "replacement") persistCustomerSession("new-token", "portal", "Carla Lima")
    finish()
    await request
    expect(getCustomerLabel()).toBe(session === "logout" ? null : session === "replacement" ? "Carla Lima" : "Beatriz Souza")
  })

  it("keeps the current label when a profile update fails or returns invalid data", async () => {
    persistCustomerSession("token", "portal", "Ana Silva")
    const patch = vi.spyOn(customerApi, "patch").mockRejectedValueOnce(new Error("Offline"))
    await expect(updateCustomerProfile({ name: "Beatriz Souza" })).rejects.toThrow()
    expect(getCustomerLabel()).toBe("Ana Silva")
    patch.mockResolvedValue({ data: {} })
    await expect(updateCustomerProfile({ name: "Beatriz Souza" })).rejects.toThrow()
    expect(getCustomerLabel()).toBe("Ana Silva")
  })
})
