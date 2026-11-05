import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppRoutes } from "@/routes/AppRoutes"
import i18n from "@/lib/i18n"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { getPortalCatalogProduct, PortalProductUnavailableError } from "@/features/catalog/services/catalogPortalService"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"

const context: CustomerAppOutletContext = {
  subdomain: "demo",
  primary: "#123456",
  branding: {
    subdomain: "demo", displayName: "Demo", logoSvg: null,
    primaryColor: "#123456", accentColor: null, welcomeTagline: null,
  },
  menu: [{ id: "catalog-menu", moduleName: "catalog", label: "Catalog", sortOrder: 0, isActive: true }],
}

// Isolate route selection from session/branding setup; keep the module guard and page real.
vi.mock("@/features/tenantPortal/components/CustomerAppLayout", () => ({
  CustomerAppLayout: () => <Outlet context={context} />,
}))
vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/tenantPortal/services/tenantPortalService")>(),
  getHostTenantSubdomain: vi.fn(),
}))
vi.mock("@/features/catalog/services/catalogPortalService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/catalog/services/catalogPortalService")>(),
  getPortalCatalogProduct: vi.fn(),
}))

describe("portal catalog product routing", () => {
  beforeEach(() => {
    vi.mocked(getPortalCatalogProduct).mockReset()
    vi.mocked(getPortalCatalogProduct).mockRejectedValue(new PortalProductUnavailableError())
  })

  it.each([
    { host: null, path: "/t/demo/catalogo/missing-product" },
    { host: "demo", path: "/catalogo/missing-product" },
    { host: "demo", path: "/t/demo/catalogo/missing-product" },
  ])("shows product unavailable at $path", async ({ host, path }) => {
    vi.mocked(getHostTenantSubdomain).mockReturnValue(host)
    render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)

    expect(await screen.findByRole("heading", {
      name: i18n.t("tenantPortal.catalog.unavailableTitle"),
    })).toBeInTheDocument()
    expect(getPortalCatalogProduct).toHaveBeenCalledWith("missing-product")
    expect(screen.queryByRole("heading", { name: i18n.t("notFound.title") })).not.toBeInTheDocument()
  })
})

describe("host mode /t/ prefix", () => {
  it("does not serve another tenant's /t/ prefix on this host", async () => {
    vi.mocked(getHostTenantSubdomain).mockReturnValue("demo")
    vi.mocked(getPortalCatalogProduct).mockReset()
    function Where() { return <output data-testid="where">{useLocation().pathname}</output> }
    render(<MemoryRouter initialEntries={["/t/other/catalogo/p1"]}><AppRoutes /><Where /></MemoryRouter>)
    expect(await screen.findByText("/nao-encontrado")).toBeInTheDocument()
    expect(getPortalCatalogProduct).not.toHaveBeenCalled()
  })

  it("strips an encoded same-tenant prefix by segment", async () => {
    vi.mocked(getHostTenantSubdomain).mockReturnValue("demo")
    vi.mocked(getPortalCatalogProduct).mockReset()
    vi.mocked(getPortalCatalogProduct).mockRejectedValue(new PortalProductUnavailableError())
    render(<MemoryRouter initialEntries={["/t/%64emo/catalogo/p1"]}><AppRoutes /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: i18n.t("tenantPortal.catalog.unavailableTitle") })).toBeInTheDocument()
    expect(getPortalCatalogProduct).toHaveBeenCalledWith("p1")
  })
})
