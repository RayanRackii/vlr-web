import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"
import { UnknownPathRoute } from "@/routes/UnknownPathRoute"

const authState = {
  user: null as { id: string; email: string } | null,
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>public-home</h1>} />
        <Route path="/login" element={<h1>staff-login</h1>} />
        <Route path="/dashboard" element={<h1>staff-dashboard</h1>} />
        <Route path="/t/:subdomain/app" element={<div>customer-portal</div>} />
        <Route path="*" element={<UnknownPathRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("UnknownPathRoute", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    authState.user = null
    authState.isLoading = false
    clearCustomerSession()

  })

  it("shows a standalone 404 page for a signed-out unknown URL, not the app chrome", () => {
    renderAt("/nao-existe")
    expect(
      screen.getByRole("heading", { name: i18n.t("notFound.title") }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "public-home" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: i18n.t("notFound.login") }),
    ).toHaveAttribute("href", "/login")
    expect(
      screen.queryByRole("button", { name: i18n.t("account.openMenu") }),
    ).not.toBeInTheDocument()
  })

  it("offers signed-in staff a dashboard link in the auth shell with one h1", async () => {
    authState.user = { id: "user-1", email: "ana@example.com" }
    renderAt("/nao-existe")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("notFound.title"))
    expect(screen.getByRole("link", { name: i18n.t("notFound.dashboard") })).toHaveAttribute("href", "/dashboard")
    expect(screen.queryByRole("button", { name: i18n.t("account.openMenu") })).not.toBeInTheDocument()
  })

  it("sends a signed-in customer (no staff session) back to their portal instead of the app chrome", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    renderAt("/nao-existe")

    expect(await screen.findByText("customer-portal")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: i18n.t("notFound.title") }),
    ).not.toBeInTheDocument()
    clearCustomerSession()
  })

  it("scenario A: a customer who logged in after staff gets the portal, not the admin-shell 404", async () => {
    authState.user = { id: "user-1", email: "ana@example.com" }
    persistCustomerSession("customer-token", "ficc", "Ana")
    renderAt("/nao-existe")

    expect(await screen.findByText("customer-portal")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: i18n.t("notFound.title") }),
    ).not.toBeInTheDocument()
    clearCustomerSession()
  })

  it("keeps a signed-out visit with no session on the standalone 404", () => {
    renderAt("/nao-existe")

    expect(
      screen.getByRole("heading", { name: i18n.t("notFound.title") }),
    ).toBeInTheDocument()
    expect(screen.queryByText("customer-portal")).not.toBeInTheDocument()
  })
})
