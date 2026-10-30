import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalManifest } from "@/features/tenantPortal/manifest"

const outletContext: TenantPortalOutletContext = {
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
}

function renderPublicRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          {tenantPortalManifest.routes.public.map((route) =>
            route.redirectToEmail ? null : (
              <Route
                key={route.path ?? "index"}
                index={route.path === undefined}
                path={route.path ? `/t/:subdomain/${route.path}` : "/t/:subdomain"}
                element={route.element}
              />
            ),
          )}
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("tenantPortalManifest public routes", () => {
  it("redirects /t/:subdomain/login to the tenant login root", async () => {
    renderPublicRoutes("/t/ficc/login")

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.login.title"),
      }),
    ).toBeInTheDocument()
  })

  it("shows an invalid-link message with a forgot-password link for /t/:subdomain/reset-password", () => {
    renderPublicRoutes("/t/ficc/reset-password")

    expect(screen.getByRole("heading", {
      level: 1,
      name: i18n.t("tenantPortal.passwordReset.invalidLinkTitle"),
    })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("tenantPortal.passwordReset.invalidLink"),
    )
    expect(
      screen.getByRole("link", {
        name: i18n.t("tenantPortal.passwordReset.requestNewLink"),
      }),
    ).toHaveAttribute("href", "/t/ficc/forgot-password")
  })
})
