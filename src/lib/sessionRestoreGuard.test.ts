import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  commitPortalBooking,
  getAgendaSessionGeneration,
  isOwnBookedSlot,
  recentPortalReservations,
  rememberOwnBooking,
  resetAgendaQueryClientForTests,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import { reservationCivilStart } from "@/features/tenantPortal/lib/agendaReservationQuery"
import type { PortalReservation } from "@/features/tenantPortal/services/tenantPortalService"
import {
  clearCustomerSession,
  getCustomerAccessToken,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  peekCurrentUserCacheForTests,
  readCurrentUser,
  resetCurrentUserCacheForTests,
} from "@/features/users/services/currentUserCache"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { customerApi } from "@/lib/api"
import { replaceBrowserLocation } from "@/lib/browserLocation"
import { supabase } from "@/lib/supabase"
import {
  authenticatedSurface,
  installSessionRestoreGuard,
  isAuthenticatedRestoreBlocked,
  loginPathForAuthenticatedPath,
  hasActiveStaffSession,
  resetSessionRestoreGuardForTests,
  signOutCustomerPortal,
  signOutStaffBeforeCustomerAuth,
  signOutStaffPortal,
} from "@/lib/sessionRestoreGuard"

vi.mock("@/lib/browserLocation", () => ({
  assignBrowserLocation: vi.fn(),
  replaceBrowserLocation: vi.fn(),
}))

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const START = "2026-10-18T15:00:00.000Z"

const profile: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin",
  email: "admin@clube.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: [],
}

function reservation(): PortalReservation {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    unitId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customerId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    customerName: "Ana",
    customerWhatsApp: "5511999999999",
    startDateTime: START,
    endDateTime: "2026-10-18T16:00:00.000Z",
    status: "Confirmed",
    totalAmount: 80,
    depositPaid: 0,
    createdAt: START,
    items: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        assetId: ASSET_ID,
        rentalAssetId: ASSET_ID,
        assetName: "Quadra",
        quantity: 1,
        unitPrice: 80,
        subTotal: 80,
      },
    ],
  }
}

function storeStaffSession(token = "staff-access-token"): void {
  window.localStorage.setItem(
    "sb-rolvix-auth-token",
    JSON.stringify({
      access_token: token,
      refresh_token: "refresh-token",
      expires_at: 1_900_000_000,
    }),
  )
}

function pageShow(persisted: boolean): Event {
  if (typeof PageTransitionEvent === "function") {
    return new PageTransitionEvent("pageshow", { persisted })
  }
  const event = new Event("pageshow")
  Object.defineProperty(event, "persisted", { value: persisted })
  return event
}

function seedRoot(text: string): void {
  document.body.innerHTML = `<div id="root"><p>${text}</p></div>`
}

describe("authenticated surface", () => {
  it("classifies staff and customer pages and leaves public URLs alone", () => {
    expect(authenticatedSurface("/configuracoes/reservas")).toBe("staff")
    expect(authenticatedSurface("/catalogo/pedidos")).toBe("staff")
    expect(authenticatedSurface("/perfil")).toBe("staff")
    expect(authenticatedSurface("/dashboard")).toBe("staff")
    expect(authenticatedSurface("/t/ficc/app")).toBe("customer")
    expect(authenticatedSurface("/t/ficc/app/perfil")).toBe("customer")
    expect(authenticatedSurface("/t/ficc/agenda/menu-id")).toBe("customer")
    expect(authenticatedSurface("/t/ficc/pedidos/order-id")).toBe("customer")
    expect(authenticatedSurface("/t/ficc/catalogo")).toBe("customer")
    expect(authenticatedSurface("/t/ficc")).toBeNull()
    expect(authenticatedSurface("/t/ficc/register")).toBeNull()
    expect(authenticatedSurface("/t/ficc/forgot-password")).toBeNull()
    expect(authenticatedSurface("/login")).toBeNull()
    expect(authenticatedSurface("/")).toBeNull()
  })

  it("sends a tenant host back to the portal root", () => {
    expect(authenticatedSurface("/app", "ficc")).toBe("customer")
    expect(authenticatedSurface("/app/perfil", "ficc")).toBe("customer")
    expect(authenticatedSurface("/agenda", "ficc")).toBe("customer")
    expect(authenticatedSurface("/pedidos", "ficc")).toBe("customer")
    expect(authenticatedSurface("/", "ficc")).toBeNull()
    expect(authenticatedSurface("/register", "ficc")).toBeNull()
    expect(loginPathForAuthenticatedPath("/app/perfil", "ficc")).toBe("/")
    expect(loginPathForAuthenticatedPath("/agenda/menu", "ficc")).toBe("/")
    expect(loginPathForAuthenticatedPath("/t/ficc/pedidos/1")).toBe("/t/ficc")
    expect(loginPathForAuthenticatedPath("/configuracoes/reservas")).toBe("/login")
    expect(loginPathForAuthenticatedPath("/catalogo/pedidos")).toBe("/login")
  })
})

describe("session restore guard", () => {
  beforeEach(() => {
    resetSessionRestoreGuardForTests()
    resetAgendaQueryClientForTests()
    resetCurrentUserCacheForTests()
    clearCustomerSession()
    window.localStorage.removeItem("sb-rolvix-auth-token")
    window.history.pushState({}, "", "/")
    document.body.innerHTML = '<div id="root"></div>'
    vi.mocked(replaceBrowserLocation).mockClear()
    installSessionRestoreGuard()
  })

  afterEach(() => {
    resetSessionRestoreGuardForTests()
    clearCustomerSession()
    window.localStorage.removeItem("sb-rolvix-auth-token")
    window.history.pushState({}, "", "/")
  })

  it.each([
    ["/t/ficc/app", "/t/ficc"],
    ["/t/ficc/app/perfil", "/t/ficc"],
    ["/t/ficc/agenda/menu-id", "/t/ficc"],
    ["/t/ficc/pedidos/order-id", "/t/ficc"],
    ["/configuracoes/reservas", "/login"],
    ["/catalogo/pedidos", "/login"],
  ])(
    "pageshow persisted on %s replaces to %s without calling the network",
    (path, login) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response())
      seedRoot("reservations and orders")
      window.history.pushState({}, "", path)

      window.dispatchEvent(pageShow(true))

      expect(replaceBrowserLocation).toHaveBeenCalledWith(login)
      expect(isAuthenticatedRestoreBlocked()).toBe(true)
      expect(document.getElementById("root")?.textContent).toBe("")
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    },
  )

  it("ignores a normal load and a restore that still has a session", () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    seedRoot("agenda")
    window.history.pushState({}, "", "/t/ficc/agenda")

    window.dispatchEvent(pageShow(false))
    expect(replaceBrowserLocation).not.toHaveBeenCalled()
    expect(document.getElementById("root")?.textContent).toBe("agenda")

    window.dispatchEvent(new Event("pagehide"))
    window.dispatchEvent(pageShow(true))
    expect(replaceBrowserLocation).not.toHaveBeenCalled()
    expect(isAuthenticatedRestoreBlocked()).toBe(false)
    expect(document.getElementById("root")?.textContent).toBe("agenda")
  })

  it("invalidates the restored document after another document signs out and signs in a new customer", async () => {
    persistCustomerSession("customer-A", "ficc", "Ana")
    seedRoot("dados de Ana")
    window.history.pushState({}, "", "/t/ficc/agenda?date=2026-10-18#minhas-reservas")
    rememberOwnBooking(reservation())
    await readCurrentUser(async () => profile)
    let resolveBooking: (value: PortalReservation) => void = () => undefined
    const pending = commitPortalBooking(
      () => new Promise<PortalReservation>((resolve) => { resolveBooking = resolve }),
      { subdomain: "ficc", dates: ["2026-10-18"] },
    )
    const outcome = pending.catch((error: unknown) => error)
    const generation = getAgendaSessionGeneration()
    const getSpy = vi.spyOn(customerApi, "get").mockResolvedValue({ data: [] })
    window.dispatchEvent(new Event("pagehide"))

    try {
      vi.resetModules()
      const nextDocument = await import("@/lib/sessionRestoreGuard")
      nextDocument.signOutCustomerPortal("ficc")
      persistCustomerSession("customer-B", "ficc", "Bruno")
      expect(getAgendaSessionGeneration()).toBe(generation)

      window.dispatchEvent(pageShow(true))
      resolveBooking(reservation())

      expect(await outcome).toMatchObject({ name: "AbortError" })
      expect(getAgendaSessionGeneration()).toBeGreaterThan(generation)
      expect(recentPortalReservations("ficc")).toEqual([])
      const civil = reservationCivilStart(START)
      if (civil === null) {
        throw new Error("expected a civil start")
      }
      expect(isOwnBookedSlot(civil.date, ASSET_ID, civil.time)).toBe(false)
      expect(peekCurrentUserCacheForTests()).toBeNull()
      expect(getSpy).not.toHaveBeenCalled()
      expect(getCustomerAccessToken()).toBe("customer-B")
      expect(isAuthenticatedRestoreBlocked()).toBe(true)
      expect(document.getElementById("root")?.textContent).toBe("")
      expect(replaceBrowserLocation).toHaveBeenCalledWith(
        "/t/ficc/agenda?date=2026-10-18#minhas-reservas",
      )
    } finally {
      getSpy.mockRestore()
    }
  })

  it("reloads a restored staff document after the stored session changes without signing out the new session", () => {
    storeStaffSession("staff-A")
    seedRoot("dados de A")
    window.history.pushState({}, "", "/dashboard")
    window.dispatchEvent(new Event("pagehide"))
    storeStaffSession("staff-B")

    window.dispatchEvent(pageShow(true))

    expect(replaceBrowserLocation).toHaveBeenCalledWith("/dashboard")
    expect(document.getElementById("root")?.textContent).toBe("")
    expect(window.localStorage.getItem("sb-rolvix-auth-token")).toContain("staff-B")
  })

  it("popstate to a staff page without a session does not let the router run", () => {
    const bubble = vi.fn()
    window.addEventListener("popstate", bubble)
    seedRoot("orders")
    window.history.pushState({}, "", "/catalogo/pedidos")

    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(bubble).not.toHaveBeenCalled()
    expect(replaceBrowserLocation).toHaveBeenCalledWith("/login")
    expect(document.getElementById("root")?.textContent).toBe("")
    window.removeEventListener("popstate", bubble)
  })

  it("popstate keeps a signed-in staff page and still notifies the router", () => {
    const bubble = vi.fn()
    window.addEventListener("popstate", bubble)
    storeStaffSession()
    seedRoot("reservations")
    window.history.pushState({}, "", "/configuracoes/reservas")

    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(bubble).toHaveBeenCalledTimes(1)
    expect(replaceBrowserLocation).not.toHaveBeenCalled()
    expect(document.getElementById("root")?.textContent).toBe("reservations")
    window.removeEventListener("popstate", bubble)
  })

  it("does not redirect a public popstate", () => {
    const bubble = vi.fn()
    window.addEventListener("popstate", bubble)
    window.history.pushState({}, "", "/t/ficc/register")

    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(bubble).toHaveBeenCalledTimes(1)
    expect(replaceBrowserLocation).not.toHaveBeenCalled()
    window.removeEventListener("popstate", bubble)
  })

  it("pagehide drops protected markup only after the session is gone", () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    seedRoot("perfil secreto")
    window.history.pushState({}, "", "/t/ficc/app/perfil")
    window.dispatchEvent(new Event("pagehide"))
    expect(document.getElementById("root")?.textContent).toBe("perfil secreto")

    clearCustomerSession()
    window.dispatchEvent(new Event("pagehide"))
    expect(document.getElementById("root")?.textContent).toBe("")
  })

})

describe("portal sign out", () => {
  beforeEach(() => {
    resetSessionRestoreGuardForTests()
    resetAgendaQueryClientForTests()
    resetCurrentUserCacheForTests()
    clearCustomerSession()
    window.localStorage.removeItem("sb-rolvix-auth-token")
    window.sessionStorage.clear()
    vi.mocked(supabase.auth.signOut).mockReset()
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })
    installSessionRestoreGuard()
    vi.mocked(replaceBrowserLocation).mockClear()
  })

  afterEach(() => {
    resetSessionRestoreGuardForTests()
    resetCurrentUserCacheForTests()
    clearCustomerSession()
    window.localStorage.removeItem("sb-rolvix-auth-token")
  })

  it("clears staff and agenda caches and ignores the signed-out token on Back", async () => {
    rememberOwnBooking(reservation())
    const civil = reservationCivilStart(START)
    if (civil === null) {
      throw new Error("expected a civil start")
    }
    await readCurrentUser(async () => profile)
    expect(peekCurrentUserCacheForTests()).not.toBeNull()
    expect(isOwnBookedSlot(civil.date, ASSET_ID, civil.time)).toBe(true)

    storeStaffSession("old-token")
    window.sessionStorage.setItem("rolvix.activeTenantLabel", "Clube")
    const signedOut = await signOutStaffPortal()

    expect(signedOut).toBe(true)
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(peekCurrentUserCacheForTests()).toBeNull()
    expect(isOwnBookedSlot(civil.date, ASSET_ID, civil.time)).toBe(false)
    expect(window.sessionStorage.getItem("rolvix.activeTenantLabel")).toBeNull()

    window.history.pushState({}, "", "/configuracoes/reservas")
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(replaceBrowserLocation).toHaveBeenCalledWith("/login")
  })

  it("still ends the local staff session when the server sign-out fails", async () => {
    storeStaffSession("still-here")
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: { name: "AuthError", message: "network" },
    } as never)
    vi.mocked(supabase.auth.admin.signOut).mockRejectedValueOnce(new Error("network"))
    const signedOut = await signOutStaffPortal()

    expect(signedOut).toBe(true)
    expect(window.localStorage.getItem("sb-rolvix-auth-token")).toBeNull()
    expect(hasActiveStaffSession()).toBe(false)
    window.history.pushState({}, "", "/dashboard")
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(replaceBrowserLocation).toHaveBeenCalledWith("/login")
  })

  it("returns the customer login path and clears that session and caches", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    rememberOwnBooking(reservation())
    await readCurrentUser(async () => profile)
    const civil = reservationCivilStart(START)
    if (civil === null) {
      throw new Error("expected a civil start")
    }

    const path = signOutCustomerPortal("ficc")

    expect(path).toBe("/t/ficc")
    expect(window.localStorage.getItem("rolvix.customer.token")).toBeNull()
    expect(peekCurrentUserCacheForTests()).toBeNull()
    expect(isOwnBookedSlot(civil.date, ASSET_ID, civil.time)).toBe(false)
  })

  it("signs out a leftover staff session before a customer authenticates", async () => {
    storeStaffSession("leftover-staff-token")
    expect(hasActiveStaffSession()).toBe(true)

    await signOutStaffBeforeCustomerAuth()

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(hasActiveStaffSession()).toBe(false)
  })

  it("does nothing when there is no staff session to sign out", async () => {
    expect(hasActiveStaffSession()).toBe(false)

    await signOutStaffBeforeCustomerAuth()

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("does not throw when staff sign-out fails/rejects", async () => {
    storeStaffSession("leftover-staff-token")
    vi.mocked(supabase.auth.signOut).mockRejectedValueOnce(new Error("network"))

    await expect(signOutStaffBeforeCustomerAuth()).resolves.toBeUndefined()
    expect(hasActiveStaffSession()).toBe(false)
  })

  it("scenario A: drops the staff session locally when the global sign-out returns an error", async () => {
    storeStaffSession("leftover-staff-token")
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: new Error("network") as never,
    })

    await signOutStaffBeforeCustomerAuth()

    expect(supabase.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" })
    expect(window.localStorage.getItem("sb-rolvix-auth-token")).toBeNull()
    expect(hasActiveStaffSession()).toBe(false)
  })

  it("scenario A: removes the stored staff session when the global sign-out rejects", async () => {
    storeStaffSession("leftover-staff-token")
    vi.mocked(supabase.auth.signOut).mockRejectedValueOnce(new Error("network"))

    await signOutStaffBeforeCustomerAuth()

    expect(window.localStorage.getItem("sb-rolvix-auth-token")).toBeNull()
  })
})
