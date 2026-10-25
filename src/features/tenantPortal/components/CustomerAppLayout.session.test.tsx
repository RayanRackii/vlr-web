import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { AxiosError, AxiosHeaders } from "axios"

import i18n from "@/lib/i18n"
import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  commitPortalBooking,
  isOwnBookedSlot,
  recentPortalReservations,
  rememberOwnBooking,
  resetAgendaQueryClientForTests,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import { reservationCivilStart } from "@/features/tenantPortal/lib/agendaReservationQuery"
import {
  clearAgendaSelectionNotice,
  showAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"
import type { PortalReservation } from "@/features/tenantPortal/services/tenantPortalService"
import {
  clearCustomerSession,
  getCustomerAccessToken,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  installSessionRestoreGuard,
  resetSessionRestoreGuardForTests,
} from "@/lib/sessionRestoreGuard"
import { UI_LANGUAGE_STORAGE_KEY } from "@/lib/uiLanguage"

vi.mock("@/lib/browserLocation", () => ({
  assignBrowserLocation: vi.fn(),
  replaceBrowserLocation: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchTenantBranding: vi.fn(),
    fetchTenantMenu: vi.fn(),
  }
})

import {
  fetchTenantBranding,
  fetchTenantMenu,
} from "@/features/tenantPortal/services/tenantPortalService"

const fetchBranding = vi.mocked(fetchTenantBranding)
const fetchMenu = vi.mocked(fetchTenantMenu)

const OWN_ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const OWN_START = "2026-10-18T15:00:00.000Z"

function ownReservation(): PortalReservation {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    unitId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customerId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    customerName: "Ana",
    customerWhatsApp: "5511999999999",
    startDateTime: OWN_START,
    endDateTime: "2026-10-18T16:00:00.000Z",
    status: "Confirmed",
    totalAmount: 80,
    depositPaid: 0,
    createdAt: OWN_START,
    items: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        assetId: OWN_ASSET_ID,
        rentalAssetId: OWN_ASSET_ID,
        assetName: "Quadra",
        quantity: 1,
        unitPrice: 80,
        subTotal: 80,
      },
    ],
  }
}

function renderPortal(path: string) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/t/:subdomain" element={<div>login-form</div>} />
          <Route path="/t/:subdomain/agenda" element={<CustomerAppLayout />}>
            <Route index element={<div>agenda-body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe("CustomerAppLayout session tenant", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(async () => {
    clearCustomerSession()
    clearAgendaSelectionNotice("ficc")
    resetAgendaQueryClientForTests()
    resetSessionRestoreGuardForTests()
    window.history.pushState({}, "", "/")
    fetchBranding.mockReset()
    fetchMenu.mockReset()
    await i18n.changeLanguage("pt-BR")
  })

  it("sends a signed-out visit to the login form", async () => {
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it("renders the branded portal 404 when the catalog menu returns HTTP 404", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockRejectedValue(
      new AxiosError("catalog inactive", undefined, undefined, undefined, {
        data: null,
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    )
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <MemoryRouter initialEntries={["/t/ficc/catalogo"]}>
          <Routes>
            <Route path="/t/:subdomain/catalogo" element={<CustomerAppLayout />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(await screen.findByRole("heading", { name: i18n.t("notFound.title") })).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("tenantPortal.errors.tenantNotFound"))).not.toBeInTheDocument()
  })

  it("keeps a catalog loading error generic when it is not an HTTP 404", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockRejectedValue(new Error("network unavailable"))
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <MemoryRouter initialEntries={["/t/ficc/catalogo"]}>
          <Routes>
            <Route path="/t/:subdomain/catalogo" element={<CustomerAppLayout />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(await screen.findByText(i18n.t("tenantPortal.errors.tenantNotFound"))).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: i18n.t("notFound.title") })).not.toBeInTheDocument()
  })

  it("does not treat a route containing catalogo as the catalog route", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockRejectedValue(
      new AxiosError("tenant missing", undefined, undefined, undefined, {
        data: null,
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    )
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <MemoryRouter initialEntries={["/t/ficc/catalogo-archive"]}>
          <Routes>
            <Route path="/t/:subdomain/*" element={<CustomerAppLayout />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(await screen.findByText(i18n.t("tenantPortal.errors.tenantNotFound"))).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: i18n.t("notFound.title") })).not.toBeInTheDocument()
  })

  it("does not open this tenant with a session saved for another tenant", async () => {
    persistCustomerSession("customer-token", "other-club", "Ana")
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
    expect(fetchMenu).not.toHaveBeenCalled()
  })

  it("opens the signed-in shell when the session matches this tenant", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("agenda-body")).toBeInTheDocument()
    expect(screen.queryByText("login-form")).not.toBeInTheDocument()
    expect(fetchBranding).toHaveBeenCalledWith("ficc")
  })

  it.each([
    ["expired", "tenantPortal.agenda.selectionExpired"],
    ["unavailable", "tenantPortal.agenda.selectionUnavailable"],
  ] as const)("keeps the %s selection notice across a shell remount until dismissed", async (notice, translationKey) => {
    const user = userEvent.setup()
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    showAgendaSelectionNotice("ficc", notice)

    renderPortal("/t/ficc/agenda")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(i18n.t(translationKey))
    await user.click(within(alert).getByRole("button", { name: i18n.t("common.close") }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("does not show an agenda notice left by a different customer in another tab", async () => {
    persistCustomerSession("customer-token-a", "ficc", "Ana", "customer-a")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    showAgendaSelectionNotice("ficc", "unavailable")

    renderPortal("/t/ficc/agenda")
    expect(await screen.findByRole("alert")).toBeInTheDocument()

    // A different tab replaces the shared customer session without running
    // this tab's login helper, so the session-scoped notice must not leak.
    window.localStorage.setItem("rolvix.customer.token", "customer-token-b")
    window.localStorage.setItem("rolvix.customer.id", "customer-b")
    window.dispatchEvent(new StorageEvent("storage", {
      key: "rolvix.customer.id",
      oldValue: "customer-a",
      newValue: "customer-b",
      storageArea: window.localStorage,
    }))

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })

  it("lists book, my reservations, and profile in the mobile menu", async () => {
    const user = userEvent.setup()
    const menuItemId = "11111111-1111-4111-8111-111111111111"
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([
      {
        id: menuItemId,
        moduleName: "rentals",
        label: "Reservar horário",
        sortOrder: 1,
        isActive: true,
        rentalAssetId: null,
      },
    ])
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("agenda-body")).toBeInTheDocument()

    const openMenu = screen.getByRole("button", { name: i18n.t("nav.openMenu") })
    expect(openMenu).toHaveClass(...headerTouchTargetClassName.split(" "))
    expect(
      screen.getByRole("button", { name: i18n.t("theme.toggle") }),
    ).toHaveClass(...headerTouchTargetClassName.split(" "))
    expect(
      screen.getByRole("button", { name: i18n.t("account.openMenu") }),
    ).toHaveClass(...headerTouchTargetClassName.split(" "))

    const language = screen.getByRole("button", { name: i18n.t("language.label") })
    expect(language).toHaveClass(...headerTouchTargetClassName.split(" "))
    expect(language).toHaveTextContent("PT")
    expect(language.querySelector("span")).not.toHaveClass("hidden")

    await user.click(openMenu)

    const dialog = await screen.findByRole("dialog")
    const book = within(dialog).getByRole("link", {
      name: i18n.t("admin.moduleMenu.suggestedLabelRentals"),
    })
    const mine = within(dialog).getByRole("link", {
      name: i18n.t("tenantPortal.agenda.myReservations"),
    })
    const profile = within(dialog).getByRole("link", {
      name: i18n.t("account.profile"),
    })

    expect(book).toHaveAttribute("href", `/t/ficc/agenda/${menuItemId}`)
    expect(mine).toHaveAttribute(
      "href",
      `/t/ficc/agenda/${menuItemId}#minhas-reservas`,
    )
    expect(profile).toHaveAttribute("href", "/t/ficc/app/perfil")
  })

  it("keeps the signed-in page mounted when the language changes", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("agenda-body")).toBeInTheDocument()
    const brandingCalls = fetchBranding.mock.calls.length
    const menuCalls = fetchMenu.mock.calls.length

    await i18n.changeLanguage("es")

    expect(screen.getByText("agenda-body")).toBeInTheDocument()
    expect(fetchBranding).toHaveBeenCalledTimes(brandingCalls)
    expect(fetchMenu).toHaveBeenCalledTimes(menuCalls)
    expect(screen.queryByText("login-form")).not.toBeInTheDocument()
  })

  it("signs out with replace, drops the agenda cache, and keeps the chosen language", async () => {
    const user = userEvent.setup()
    const reservation = ownReservation()
    let resolveBooking: (value: PortalReservation) => void = () => undefined
    const booking = commitPortalBooking(
      () => new Promise<PortalReservation>((resolve) => {
        resolveBooking = resolve
      }),
      { subdomain: "ficc", dates: ["2026-10-18"] },
    )
    const discarded = expect(booking).rejects.toMatchObject({ name: "AbortError" })
    rememberOwnBooking(reservation)
    const civil = reservationCivilStart(OWN_START)
    if (civil === null) {
      throw new Error("expected a civil start")
    }
    expect(isOwnBookedSlot(civil.date, OWN_ASSET_ID, civil.time)).toBe(true)

    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    const router = createMemoryRouter(
      [
        { path: "/t/:subdomain", element: <div>login-form</div> },
        {
          path: "/t/:subdomain/agenda",
          element: <CustomerAppLayout />,
          children: [{ index: true, element: <div>agenda-body</div> }],
        },
      ],
      { initialEntries: ["/t/ficc/agenda"] },
    )
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    )
    expect(await screen.findByText("agenda-body")).toBeInTheDocument()

    await i18n.changeLanguage("en")
    await user.click(screen.getByRole("button", { name: i18n.t("account.openMenu") }))
    await user.click(
      await screen.findByRole("menuitem", { name: i18n.t("account.signOut") }),
    )

    expect(getCustomerAccessToken()).toBeNull()
    expect(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)).toBe("en")
    expect(router.state.location.pathname).toBe("/t/ficc")
    expect(router.state.historyAction).toBe("REPLACE")
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(isOwnBookedSlot(civil.date, OWN_ASSET_ID, civil.time)).toBe(false)
    persistCustomerSession("next-customer-token", "ficc", "Bruno")
    resolveBooking(reservation)
    await discarded
    expect(recentPortalReservations("ficc")).toEqual([])
    expect(isOwnBookedSlot(civil.date, OWN_ASSET_ID, civil.time)).toBe(false)
    expect(fetchBranding).toHaveBeenCalledTimes(1)
  })

  it("does not render the agenda or call the API when history restore has no session", async () => {
    installSessionRestoreGuard()
    window.history.pushState({}, "", "/t/ficc/app/perfil")
    window.dispatchEvent(new PopStateEvent("popstate"))
    renderPortal("/t/ficc/agenda")

    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(screen.queryByText("login-form")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
    expect(fetchMenu).not.toHaveBeenCalled()
  })
})
