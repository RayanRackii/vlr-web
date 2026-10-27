import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainLayout } from "@/components/layout/MainLayout"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

const authState = {
  user: {
    id: "user-a",
    email: "admin-a@example.com",
    app_metadata: {},
  } as {
    id: string
    email: string
    app_metadata: Record<string, unknown>
  },
  session: {},
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

const basePayload = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: [],
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("MainLayout header identity", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    apiGet.mockReset()
  })

  it("shows the staff member's name, truncated and accessible via title", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return { data: { ...basePayload, fullName: "Ana Professora" } }
      }
      return { data: [] }
    })
    const user = userEvent.setup()
    renderShell()

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument()

    const menuButton = await screen.findByRole("button", {
      name: i18n.t("account.openMenu"),
    })
    await waitFor(() => {
      expect(menuButton).toHaveAttribute("title", "Ana Professora")
    })

    await user.click(menuButton)
    const label = await screen.findByText("Ana Professora")
    expect(label).toHaveClass("truncate")
  })

  it("falls back to the e-mail when the staff member has no full name", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/users/me")) {
        return { data: { ...basePayload, fullName: "" } }
      }
      return { data: [] }
    })
    const user = userEvent.setup()
    renderShell()

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument()

    const menuButton = await screen.findByRole("button", {
      name: i18n.t("account.openMenu"),
    })
    await waitFor(() => {
      expect(menuButton).toHaveAttribute("title", "admin-a@example.com")
    })

    await user.click(menuButton)
    expect(await screen.findByText("admin-a@example.com")).toBeInTheDocument()
  })
})
