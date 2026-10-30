import { act, render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { PortalNotFoundRoute } from "./PortalNotFoundRoute"
import { TenantPortalInvalidResetLinkPage } from "../pages/TenantPortalInvalidResetLinkPage"
import { fetchTenantMenu, isCustomerSignedInForTenant } from "../services/tenantPortalService"

vi.mock("../services/tenantPortalService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/tenantPortalService")>(),
  fetchTenantMenu: vi.fn(),
  isCustomerSignedInForTenant: vi.fn(),
}))

const rentals = {
  id: "7d71fe43-32a5-4e42-b28b-39ea3249c653",
  moduleName: "rentals", label: "Reservar horário", isActive: true, sortOrder: 0,
}

function renderState(path = "/t/acme/missing", tenantExists = true, hostMode = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={hostMode ? "/" : "/t/:subdomain"} element={<Outlet context={{ subdomain: "acme" }} />}>
          <Route path="reset-password" element={<TenantPortalInvalidResetLinkPage />} />
          <Route path="*" element={<PortalNotFoundRoute tenantExists={tenantExists} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("portal recovery states", () => {
  beforeEach(() => {
    vi.mocked(isCustomerSignedInForTenant).mockReturnValue(false)
    vi.mocked(fetchTenantMenu).mockReset().mockResolvedValue([rentals])
  })
  afterEach(async () => { await i18n.changeLanguage("pt-BR") })

  it("takes a signed-out customer to this portal's login without offering booking", () => {
    renderState()
    expect(screen.getByRole("heading", { level: 1, name: "Página não encontrada" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/t/acme")
    expect(screen.queryByRole("link", { name: "Reservar horário" })).not.toBeInTheDocument()
    expect(fetchTenantMenu).not.toHaveBeenCalled()
  })

  it("takes a signed-in customer home and offers the available booking menu entry", async () => {
    vi.mocked(isCustomerSignedInForTenant).mockReturnValue(true)
    renderState()
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/t/acme/app")
    expect(await screen.findByRole("link", { name: "Reservar horário" })).toHaveAttribute("href", `/t/acme/agenda/${rentals.id}`)
  })

  it.each([
    { menu: [] },
    { menu: [{ ...rentals, isActive: false }] },
    { menu: [{ ...rentals, moduleName: "catalog" }] },
  ])(
    "omits booking when the public menu has no active rentals entry ($menu)", async ({ menu }) => {
      vi.mocked(isCustomerSignedInForTenant).mockReturnValue(true)
      vi.mocked(fetchTenantMenu).mockResolvedValue(menu)
      await act(async () => { renderState() })
      expect(fetchTenantMenu).toHaveBeenCalledWith("acme")
      expect(screen.queryByRole("link", { name: "Reservar horário" })).not.toBeInTheDocument()
    },
  )

  it("keeps home usable if the menu cannot be loaded", async () => {
    vi.mocked(isCustomerSignedInForTenant).mockReturnValue(true)
    vi.mocked(fetchTenantMenu).mockRejectedValue(new Error("offline"))
    await act(async () => { renderState() })
    expect(fetchTenantMenu).toHaveBeenCalledWith("acme")
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/t/acme/app")
    expect(screen.queryByRole("link", { name: "Reservar horário" })).not.toBeInTheDocument()
  })

  it("leaves an unknown tenant without offering booking", () => {
    vi.mocked(isCustomerSignedInForTenant).mockReturnValue(true)
    renderState("/t/acme/missing", false)
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/")
    expect(fetchTenantMenu).not.toHaveBeenCalled()
  })

  it("uses the outlet tenant when the route has no slug parameter", async () => {
    vi.mocked(isCustomerSignedInForTenant).mockReturnValue(true)
    renderState("/missing", true, true)
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/t/acme/app")
    expect(await screen.findByRole("link", { name: "Reservar horário" })).toHaveAttribute("href", `/t/acme/agenda/${rentals.id}`)
  })

  it.each([
    ["pt-BR", "Página não encontrada", "Ir para o início"],
    ["en", "Page not found", "Go to the home"],
    ["es", "Página no encontrada", "Ir al inicio"],
  ])("offers portal recovery in %s", async (language, heading, action) => {
    await i18n.changeLanguage(language)
    renderState()
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeVisible()
    expect(screen.getByRole("link", { name: action })).toHaveAttribute("href", "/t/acme")
  })

  it.each([
    ["pt-BR", "Link inválido ou expirado", "Solicitar novo link"],
    ["en", "Invalid or expired link", "Request a new link"],
    ["es", "Enlace inválido o vencido", "Solicitar un nuevo enlace"],
  ])("offers password recovery in %s", async (language, heading, action) => {
    await i18n.changeLanguage(language)
    renderState("/t/acme/reset-password?token=stale")
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeVisible()
    expect(screen.getByRole("link", { name: action })).toHaveAttribute("href", "/t/acme/forgot-password")
  })
})
