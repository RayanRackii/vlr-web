import type { ReactNode } from "react"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainLayout } from "@/components/layout/MainLayout"
import { resetCurrentUserCacheForTests } from "@/features/users/services/currentUserCache"
import { api } from "@/lib/api"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a", email: "admin-a@example.com", app_metadata: {} }, session: {}, isLoading: false }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

const apiGet = vi.mocked(api.get)

const payload = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin-a@example.com",
  fullName: "Ana Professora",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["catalog.products.manage"],
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/catalogo/produtos" element={<h1>Lista</h1>} />
          <Route path="/catalogo/produtos/cadastro" element={<h1>Novo</h1>} />
          <Route path="/catalogo/produtos/:id/cadastro" element={<h1>Editar</h1>} />
          <Route path="/configuracoes/recursos/:id/cadastro" element={<h1>Recurso</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("MainLayout on cadastro routes", () => {
  beforeEach(() => {
    resetCurrentUserCacheForTests()
    apiGet.mockReset()
    apiGet.mockImplementation(async (url: string) => String(url).includes("/api/users/me") ? { data: payload } : { data: [] })
  })

  it.each([
    "/catalogo/produtos/cadastro",
    "/catalogo/produtos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cadastro",
    "/configuracoes/recursos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cadastro",
  ])("keeps the sidebar and shows the wizard breadcrumb in the top bar on %s", async (path) => {
    const { container } = renderAt(path)
    await screen.findByRole("heading", { level: 1 })
    expect(container.querySelector('[data-shell-part="sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-shell-variant="focus"]')).toBeNull()
    const header = container.querySelector('[data-shell-part="header"]') as HTMLElement
    expect(within(header).getByRole("navigation")).toBeInTheDocument()
    // Below lg the top-bar breadcrumb is hidden, so the wizard crumbs also render in the content.
    const contentCrumbs = container.querySelector('[data-shell-part="content-breadcrumb"]') as HTMLElement
    expect(contentCrumbs).toHaveClass("lg:hidden")
    expect(within(contentCrumbs).getByRole("navigation")).toBeInTheDocument()
    // Account menu and notifications still come from the normal staff shell.
    expect(within(header).getByRole("button", { name: "Abrir menu da conta" })).toBeInTheDocument()
  })

  it("links the Produtos crumb back to the list on the creation route", async () => {
    renderAt("/catalogo/produtos/cadastro")
    await screen.findByRole("heading", { name: "Novo" })
    const header = document.querySelector('[data-shell-part="header"]') as HTMLElement
    const nav = within(header).getByRole("navigation")
    expect(within(nav).getByRole("link", { name: "Produtos" })).toHaveAttribute("href", "/catalogo/produtos")
    expect(within(nav).getByText("Novo produto")).toHaveAttribute("aria-current", "page")
  })

  it.each(["/dashboard", "/catalogo/produtos"])("keeps the sidebar on %s", async (path) => {
    const { container } = renderAt(path)
    await screen.findByRole("heading", { level: 1 })
    expect(container.querySelector('[data-shell-part="sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-shell-variant="focus"]')).toBeNull()
  })
})
