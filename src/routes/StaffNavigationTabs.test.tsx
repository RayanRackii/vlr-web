import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { adminManifest } from "@/features/admin/manifest"
import { assetsManifest } from "@/features/assets/manifest"
import { pmocManifest } from "@/features/pmoc/manifest"
import { rentalsManifest } from "@/features/rentals/manifest"
import { usersManifest } from "@/features/users/manifest"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { listRoles } from "@/features/users/services/rolesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: true }),
}))
vi.mock("@/features/assets/pages/AssetsPage", () => ({ AssetsPage: () => <div>equipment content</div> }))
vi.mock("@/features/assets/pages/AssetCategoriesPage", () => ({ AssetCategoriesPage: () => <div>equipment types content</div> }))
vi.mock("@/features/rentals/pages/ReservationsPage", () => ({ ReservationsPage: () => <div>reservations content</div> }))
vi.mock("@/features/rentals/pages/BookingPolicyPage", () => ({ BookingPolicyPage: () => <div>booking rules content</div> }))
vi.mock("@/features/pmoc/pages/CreatePlanPage", () => ({ CreatePlanPage: () => <div>custom plan content</div> }))
vi.mock("@/features/pmoc/pages/PmocLibraryPage", () => ({ PmocLibraryPage: () => <div>library content</div> }))
vi.mock("@/features/admin/pages/TenantRegistrationFieldsPage", () => ({ TenantRegistrationFieldsPage: () => <div>registration content</div> }))
vi.mock("@/features/users/components/PeopleUsersTab", () => ({ PeopleUsersTab: () => <div>team content</div> }))
vi.mock("@/features/users/components/PeopleCustomersTab", () => ({ PeopleCustomersTab: () => <div>customers content</div> }))
vi.mock("@/features/users/components/PeopleRolesTab", () => ({ PeopleRolesTab: () => <div>roles content</div> }))
vi.mock("@/features/users/services/rolesService", () => ({ listRoles: vi.fn(async () => []), listPermissions: vi.fn(async () => []) }))

function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={() => { void navigate(-1) }}>history back</button></>
}

function renderRoute(path: string, permissions: string[], modules: string[] = ["inventory", "rentals", "catalog", "pmoc"]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions} activeModules={modules}>
        <Location />
        <Routes>
          {[...assetsManifest.routes.staff, ...pmocManifest.routes.staff, ...adminManifest.routes.staff, ...usersManifest.routes.staff].map((route) => (
            <Route key={route.path} element={<PermissionRoute permission={route.permission} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          {rentalsManifest.routes.staff.map((route) => (
            <Route key={route.path} element={<PermissionRoute permissions={route.permissions} />}>
              <Route path={route.path} element={route.element} />
            </Route>
          ))}
          <Route path="*" element={<div>route not found</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

const legacyTabs = [
  { path: "/ativos/categorias", permission: "inventory.categories.read", content: "equipment types content", tab: "nav.assetsCategories", hidden: "nav.assetsInventory", module: "inventory" },
  { path: "/configuracoes/politica-reservas", permission: "rentals.booking_policy.read", content: "booking rules content", tab: "nav.bookingPolicy", hidden: "nav.reservations", module: "rentals" },
  { path: "/pmoc/biblioteca", permission: "pmoc.templates.read", content: "library content", tab: "nav.pmocLibrary", hidden: "nav.pmocCustom", module: "pmoc" },
]

describe("legacy sidebar URLs rendered inside their new screens", () => {
  it.each([
    ["/ativos/", "inventory.assets.read", "equipment content"],
    ["/ativos/categorias/", "inventory.categories.read", "equipment types content"],
    ["/configuracoes/reservas/", "rentals.reservations.read", "reservations content"],
    ["/configuracoes/politica-reservas/", "rentals.booking_policy.read", "booking rules content"],
    ["/pmoc/novo/", "pmoc.plans.write", "custom plan content"],
    ["/pmoc/biblioteca/", "pmoc.templates.read", "library content"],
    ["/configuracoes/cadastro/", "core.registration_fields.read", "registration content"],
  ])("keeps the existing trailing-slash URL %s usable", (path, permission, content) => {
    renderRoute(path, [permission])
    expect(screen.getByText(content)).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: i18n.t("accessDenied.title") })).not.toBeInTheDocument()
  })

  it.each(legacyTabs)("opens $path as a gated tab with only its original permission", ({ path, permission, content, tab, hidden }) => {
    renderRoute(path, [permission])
    expect(screen.getByText(content)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: i18n.t(tab) })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: i18n.t(hidden) })).not.toBeInTheDocument()
    expect(screen.queryByText("route not found")).not.toBeInTheDocument()
  })

  it.each(legacyTabs)("denies $path without its original permission", ({ path, content }) => {
    renderRoute(path, [])
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it.each(legacyTabs)("does not mount $path content while its module is off", ({ path, permission, content, module }) => {
    renderRoute(path, [permission], ["catalog", "rentals", "pmoc", "inventory"].filter((entry) => entry !== module))
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it.each([
    ["/ativos", "inventory.assets.read", "equipment content", "nav.assetsInventory", "nav.assetsCategories"],
    ["/configuracoes/reservas", "rentals.reservations.read", "reservations content", "nav.reservations", "nav.bookingPolicy"],
    ["/pmoc/novo", "pmoc.plans.write", "custom plan content", "nav.pmocCustom", "nav.pmocLibrary"],
  ])("keeps the main page %s usable without the absorbed tab's permission", (path, permission, content, tab, hidden) => {
    renderRoute(path, [permission])
    expect(screen.getByText(content)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: i18n.t(tab) })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: i18n.t(hidden) })).not.toBeInTheDocument()
  })

  it("navigates between reservations and booking rules and restores the selected tab on Back", async () => {
    const user = userEvent.setup()
    renderRoute("/configuracoes/reservas", ["rentals.reservations.read", "rentals.booking_policy.read"])
    await user.click(screen.getByRole("tab", { name: i18n.t("nav.bookingPolicy") }))
    expect(screen.getByTestId("location")).toHaveTextContent("/configuracoes/politica-reservas")
    expect(screen.getByText("booking rules content")).toBeInTheDocument()
    expect(screen.queryByText("reservations content")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "history back" }))
    expect(screen.getByRole("tab", { name: i18n.t("nav.reservations") })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("reservations content")).toBeInTheDocument()
  })

  it.each(["catalog", "rentals"])("keeps registration-only access through People and access with %s", (module) => {
    renderRoute("/configuracoes/cadastro", ["core.registration_fields.read"], [module])
    expect(screen.getByText("registration content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("nav.registrationFields") })).toBeInTheDocument()
    expect(screen.queryByText("team content")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("peopleAccess.tabs.users") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("peopleAccess.tabs.roles") })).not.toBeInTheDocument()
  })

  it("denies the registration content when neither supported module is enabled", () => {
    renderRoute("/configuracoes/cadastro", ["core.registration_fields.read"], ["inventory"])
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
    expect(screen.queryByText("registration content")).not.toBeInTheDocument()
  })

  it("denies the old registration URL when only people access is granted", () => {
    renderRoute("/configuracoes/cadastro", ["core.users.read"])
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
    expect(screen.queryByText("registration content")).not.toBeInTheDocument()
  })

  it("opens Roles directly from registration and restores registration on Back", async () => {
    vi.mocked(listRoles).mockClear()
    const user = userEvent.setup()
    renderRoute("/configuracoes/cadastro", ["core.registration_fields.read", "core.users.read", "core.roles.read"])
    expect(listRoles).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.roles") }))
    await waitFor(() => expect(screen.getByText("roles content")).toBeInTheDocument())
    expect(screen.getByTestId("location")).toHaveTextContent("/pessoas-e-acesso?tab=roles")
    expect(screen.queryByText("registration content")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "history back" }))
    expect(screen.getByText("registration content")).toBeInTheDocument()
  })
})
