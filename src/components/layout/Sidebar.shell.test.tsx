import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/layout/Sidebar"
import i18n from "@/lib/i18n"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({
    isPlatformAdmin: false,
    isInTenantEnvironment: false,
    activeTenantId: null,
    activeTenantLabel: null,
    clearTenantLabel: () => undefined,
  }),
}))

const permissions = ["core.dashboard.read", "rentals.reservations.read", "rentals.schedule.read", "rentals.assets.read"]

function renderSidebar(props: React.ComponentProps<typeof Sidebar> = {}, path = "/agendas") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
        <Sidebar {...props} />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("Sidebar target layout", () => {
  it("shows the brand mark and the tenant card with the workspace caption", () => {
    const { container } = renderSidebar({ workspaceName: "ZZ-R14 Locação" })
    expect(container.querySelector("[data-sidebar-mark]")).toHaveTextContent(i18n.t("app.name").charAt(0))
    const card = screen.getByTestId("sidebar-workspace")
    expect(within(card).getByText("ZZ-R14 Locação")).toBeInTheDocument()
    expect(within(card).getByText(i18n.t("nav.workspaceCaption"))).toBeInTheDocument()
  })

  it("shows the platform label on the platform panel", () => {
    renderSidebar({ workspaceName: "Ignorado", platformWorkspace: true })
    const card = screen.getByTestId("sidebar-workspace")
    expect(within(card).getByText(i18n.t("nav.platformWorkspace"))).toBeInTheDocument()
    expect(within(card).queryByText("Ignorado")).not.toBeInTheDocument()
  })

  it("collapses the tenant card to its initial", () => {
    renderSidebar({ workspaceName: "ZZ-R14 Locação", collapsed: true })
    expect(screen.getByTitle("ZZ-R14 Locação")).toHaveTextContent("Z")
  })

  it("marks the active row with a tint and no indicator pill", () => {
    const { container } = renderSidebar()
    const active = screen.getByRole("link", { name: "Visão geral", current: "page" })
    expect(active).toHaveClass("bg-primary/10", "text-primary", "font-medium")
    expect(container.querySelector(".rounded-r-full")).toBeNull()
  })

  it("renders no separators between sections", () => {
    renderSidebar()
    expect(screen.getByRole("navigation", { name: i18n.t("nav.menu") }).querySelector('[data-slot="separator"]')).toBeNull()
  })

  it("renders settings in the bottom area, not in the main nav", () => {
    renderSidebar({ account: <div>account card</div> })
    const bottom = screen.getByTestId("sidebar-bottom")
    expect(within(bottom).getByRole("button", { name: /Configurações/ })).toBeInTheDocument()
    expect(within(bottom).getByText("account card")).toBeInTheDocument()
    expect(within(screen.getByRole("navigation", { name: i18n.t("nav.menu") })).queryByText("Configurações")).not.toBeInTheDocument()
  })
})
