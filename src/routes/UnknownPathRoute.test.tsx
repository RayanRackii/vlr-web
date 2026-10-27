import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"
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

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const apiGet = vi.mocked(api.get)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>public-home</h1>} />
        <Route path="/t/:subdomain/app" element={<div>customer-portal</div>} />
        <Route path="*" element={<UnknownPathRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("UnknownPathRoute", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    authState.user = null
    authState.isLoading = false
    clearCustomerSession()
    apiGet.mockReset()
    apiGet.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        fullName: "Ana Professora",
        email: "ana@example.com",
        role: "USER",
        tenantId: "22222222-2222-4222-8222-222222222222",
        activeModules: ["rentals"],
        activeAssetFamilies: [],
        isTrial: false,
        isTrialReadOnly: false,
        notificationsEmailOnly: false,
        roles: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Professor",
            isSystemRole: true,
          },
        ],
        permissions: ["rentals.schedule.read"],
        tenantTradeName: "FICC",
      },
    })
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
      screen.getByRole("link", { name: i18n.t("notFound.home") }),
    ).toHaveAttribute("href", "/")
    expect(
      screen.queryByRole("button", { name: i18n.t("account.openMenu") }),
    ).not.toBeInTheDocument()
  })

  it("keeps a signed-in unknown URL inside the app shell", async () => {
    const user = userEvent.setup()
    authState.user = { id: "user-1", email: "ana@example.com" }
    renderAt("/nao-existe")

    expect(
      await screen.findByRole("heading", { name: i18n.t("notFound.title") }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "public-home" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: i18n.t("notFound.home") }),
    ).toHaveAttribute("href", "/dashboard")
    expect(screen.getByRole("button", { name: i18n.t("common.back") })).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: i18n.t("account.openMenu") }),
    )
    expect(
      await screen.findByRole("menuitem", { name: i18n.t("account.profile") }),
    ).toHaveAttribute("href", "/perfil")
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
