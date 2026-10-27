import { useEffect, type ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import { replaceBrowserLocation } from "@/lib/browserLocation"
import {
  installSessionRestoreGuard,
  resetSessionRestoreGuardForTests,
} from "@/lib/sessionRestoreGuard"

vi.mock("@/lib/browserLocation", () => ({
  assignBrowserLocation: vi.fn(),
  replaceBrowserLocation: vi.fn(),
}))

const authState = {
  user: null as { id: string; email: string } | null,
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

function LoginProbe() {
  const [params] = useSearchParams()
  return (
    <div>
      {`login next=${params.get("next") ?? ""} company=${params.get("company") ?? ""}`}
    </div>
  )
}

function renderRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>landing</div>} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/t/:subdomain" element={<div>b2c-login</div>} />
        <Route path="/t/:subdomain/app" element={<div>customer-app</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>staff-dashboard</div>} />
          <Route path="/os" element={<div>staff-orders</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute unauthenticated staff routing", () => {
  beforeEach(() => {
    authState.user = null
    authState.isLoading = false
    resetSessionRestoreGuardForTests()
    window.history.pushState({}, "", "/")
  })

  it("sends unauthenticated protected URLs to /login with a safe next path", () => {
    renderRoutes("/os")
    expect(screen.getByText("login next=/os company=")).toBeInTheDocument()
    expect(screen.queryByText("landing")).not.toBeInTheDocument()
    expect(screen.queryByText("staff-orders")).not.toBeInTheDocument()
  })

  it("scenario A: a customer who logged in after staff never sees the admin shell", () => {
    authState.user = { id: "staff-1", email: "staff@clube.com" }
    persistCustomerSession("customer-token", "ficc", "Ana")
    renderRoutes("/dashboard")
    expect(screen.getByText("customer-app")).toBeInTheDocument()
    expect(screen.queryByText("staff-dashboard")).not.toBeInTheDocument()
    clearCustomerSession()
  })

  it("keeps staff on the admin shell when no customer session exists", () => {
    authState.user = { id: "staff-1", email: "staff@clube.com" }
    renderRoutes("/dashboard")
    expect(screen.getByText("staff-dashboard")).toBeInTheDocument()
  })

  it("sends a signed-in customer (no staff session) back to their portal instead of staff login", () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    renderRoutes("/dashboard")
    expect(screen.getByText("customer-app")).toBeInTheDocument()
    expect(screen.queryByText(/^login/)).not.toBeInTheDocument()
    expect(screen.queryByText("staff-dashboard")).not.toBeInTheDocument()
    clearCustomerSession()
  })

  it("keeps the ?company= tenant context when redirecting to staff login", () => {
    renderRoutes("/dashboard?company=ficc")
    expect(
      screen.getByText("login next=/dashboard?company=ficc company=ficc"),
    ).toBeInTheDocument()
  })

  it("lets an authenticated user keep the protected URL", () => {
    authState.user = { id: "user-1", email: "admin@clube.com" }
    renderRoutes("/dashboard")
    expect(screen.getByText("staff-dashboard")).toBeInTheDocument()
    expect(screen.queryByText("login")).not.toBeInTheDocument()
  })

  it("does not change public landing", () => {
    renderRoutes("/")
    expect(screen.getByText("landing")).toBeInTheDocument()
    expect(screen.queryByText(/^login/)).not.toBeInTheDocument()
  })

  it("does not send B2C portal routes through staff login", () => {
    renderRoutes("/t/ficc")
    expect(screen.getByText("b2c-login")).toBeInTheDocument()
    expect(screen.queryByText(/^login/)).not.toBeInTheDocument()
  })

  it("does not render protected content or call the API after a logged-out history restore", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response())
    authState.user = { id: "user-1", email: "admin@clube.com" }
    installSessionRestoreGuard()
    window.history.pushState({}, "", "/catalogo/pedidos")
    window.dispatchEvent(new PopStateEvent("popstate"))

    function OrdersProbe() {
      useEffect(() => {
        void fetch("/api/catalog/orders")
      }, [])
      return <div>staff-orders</div>
    }

    render(
      <MemoryRouter initialEntries={["/catalogo/pedidos"]}>
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/catalogo/pedidos" element={<OrdersProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText("staff-orders")).not.toBeInTheDocument()
    expect(screen.queryByText("Carregando...")).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(replaceBrowserLocation).toHaveBeenCalledWith("/login")
    fetchSpy.mockRestore()
  })
})
