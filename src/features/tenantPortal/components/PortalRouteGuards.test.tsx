import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from "react-router-dom"
import { describe, expect, it } from "vitest"

import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { PortalModuleGuard } from "@/features/tenantPortal/components/PortalModuleGuard"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import i18n from "@/lib/i18n"

const context: CustomerAppOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
  menu: [],
}

describe("portal route guards", () => {
  it("renders a portal not-found route with a link to this tenant's home", () => {
    render(
      <MemoryRouter initialEntries={["/t/ficc/missing"]}>
        <Routes>
          <Route path="/t/:subdomain/*" element={<PortalNotFoundRoute />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: i18n.t("notFound.title") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("notFound.home") })).toHaveAttribute("href", "/t/ficc")
  })

  it("does not mount a module route that is absent from the public menu", () => {
    render(
      <MemoryRouter initialEntries={["/t/ficc/catalogo"]}>
        <Routes>
          <Route path="/t/:subdomain" element={<Outlet context={context} />}>
            <Route element={<PortalModuleGuard moduleName="catalog" />}>
              <Route path="catalogo" element={<p>catalog content</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText("catalog content")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: i18n.t("notFound.title") })).toBeInTheDocument()
  })

  it("mounts an active module route and forwards the layout context", () => {
    function ContextConsumer() {
      const { subdomain } = useOutletContext<CustomerAppOutletContext>()
      return <p>catalog for {subdomain}</p>
    }
    const withCatalog = {
      ...context,
      menu: [{ moduleName: "catalog", label: "Catálogo", isActive: true, sortOrder: 0 }],
    } as unknown as CustomerAppOutletContext
    render(
      <MemoryRouter initialEntries={["/t/ficc/catalogo"]}>
        <Routes>
          <Route path="/t/:subdomain" element={<Outlet context={withCatalog} />}>
            <Route element={<PortalModuleGuard moduleName="catalog" />}>
              <Route path="catalogo" element={<ContextConsumer />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("catalog for ficc")).toBeInTheDocument()
  })
})
