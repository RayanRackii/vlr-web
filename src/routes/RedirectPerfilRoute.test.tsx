import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

import { RedirectPerfilRoute } from "@/routes/AppRoutes"
import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

vi.mock("@/lib/sessionRestoreGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sessionRestoreGuard")>()
  return { ...actual, hasActiveStaffSession: vi.fn(() => false) }
})

import { hasActiveStaffSession } from "@/lib/sessionRestoreGuard"

const staffSessionActive = vi.mocked(hasActiveStaffSession)

function renderPerfilRoute(initialEntry: string) {
  const router = createMemoryRouter(
    [
      { path: "/t/:subdomain/perfil/*", element: <RedirectPerfilRoute /> },
      { path: "/t/:subdomain/app/perfil", element: <div>customer-profile</div> },
      { path: "/perfil/edit", element: <div>staff-profile</div> },
      { path: "/t/:subdomain", element: <div>portal-home</div> },
    ],
    { initialEntries: [initialEntry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe("RedirectPerfilRoute", () => {
  afterEach(() => {
    clearCustomerSession()
    staffSessionActive.mockReset()
    staffSessionActive.mockReturnValue(false)
  })

  it("sends a signed-in customer to their own profile, even when a staff session also exists", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    staffSessionActive.mockReturnValue(true)

    const router = renderPerfilRoute("/t/ficc/perfil/edit")

    expect(await screen.findByText("customer-profile")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc/app/perfil")
  })

  it("falls back to the staff route only when no customer session exists", async () => {
    staffSessionActive.mockReturnValue(true)

    const router = renderPerfilRoute("/t/ficc/perfil/edit")

    expect(await screen.findByText("staff-profile")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/perfil/edit")
  })

  it("sends an anonymous visitor to the portal home when neither session exists", async () => {
    staffSessionActive.mockReturnValue(false)

    const router = renderPerfilRoute("/t/ficc/perfil/edit")

    expect(await screen.findByText("portal-home")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc")
  })
})
