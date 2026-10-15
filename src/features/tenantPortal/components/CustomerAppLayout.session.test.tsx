import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "next-themes"

import i18n from "@/lib/i18n"
import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

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

  afterEach(() => {
    clearCustomerSession()
    fetchBranding.mockReset()
    fetchMenu.mockReset()
  })

  it("sends a signed-out visit to the login form", async () => {
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
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
})
