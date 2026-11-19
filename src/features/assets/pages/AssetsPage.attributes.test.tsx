import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const authSession = vi.hoisted(() => ({ access_token: "test" }))
const profile = vi.hoisted(() => ({ families: ["goods"] as string[] }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Admin",
    email: "admin@example.com",
    role: "USER",
    tenantId: null,
    activeModules: ["inventory"],
    activeAssetFamilies: profile.families,
    isTrial: false,
    isTrialReadOnly: false,
    notificationsEmailOnly: false,
    roles: [],
    permissions: [],
  })),
}))

vi.mock("@/features/assets/services/assetsService", () => ({
  getAssets: vi.fn(),
  getAssetById: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
}))
vi.mock("@/features/assets/services/assetCategoriesService", () => ({ getCategories: vi.fn() }))
vi.mock("@/features/assets/services/unitsService", () => ({ getUnits: vi.fn() }))
vi.mock("@/features/assets/services/assetFamiliesService", () => ({ listActiveAssetFamilies: vi.fn() }))

import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { listActiveAssetFamilies } from "@/features/assets/services/assetFamiliesService"
import { getAssets } from "@/features/assets/services/assetsService"
import { getUnits } from "@/features/assets/services/unitsService"

const FAMILY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const FAMILY = {
  id: FAMILY_ID,
  key: "printer_3d",
  label: "Impressora 3D",
  sortOrder: 1,
  isActive: true,
  fields: [
    { key: "materials", type: "multiselect", required: false, label: "Materiais", options: ["PLA", "PETG"] },
    { key: "build_x", type: "number", required: false, label: "X", unit: "mm", group: "Volume" },
    { key: "build_y", type: "number", required: false, label: "Y", unit: "mm", group: "Volume" },
    { key: "source", type: "url", required: false, label: "Fonte" },
    { key: "notes", type: "longtext", required: false, label: "Observações" },
  ],
}

const ASSET = {
  id: "a0000001-0000-4000-8000-000000000001",
  tenantId: TENANT_ID,
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  categoryId: CATEGORY_ID,
  familyId: FAMILY_ID,
  attributes: {
    materials: ["PLA", "PETG"],
    build_x: 256,
    build_y: "300",
    source: "javascript:alert(1)",
    notes: "linha 1\nlinha 2",
  },
  name: "Impressora Sala 2",
  tag: "IMP-01",
  location: "Lab",
  status: "Active",
  isRentable: false,
  requiresMaintenance: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  scheduledDeletionAt: null,
}

function renderPage(permissions: string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["inventory"]}>
        <AssetsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("AssetsPage attributes", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    profile.families = ["goods"]
    vi.mocked(getAssets).mockReset().mockResolvedValue([ASSET] as never)
    vi.mocked(getCategories)
      .mockReset()
      .mockResolvedValue([
        { id: CATEGORY_ID, tenantId: TENANT_ID, name: "Impressoras", createdAt: "2026-10-01T00:00:00.000Z", linkedAssetsCount: 1 },
      ] as never)
    vi.mocked(getUnits).mockReset().mockResolvedValue([])
    vi.mocked(listActiveAssetFamilies).mockReset().mockResolvedValue([FAMILY] as never)
  })

  it("shows compact attribute chips in the list, capped with a +N count", async () => {
    renderPage(["inventory.assets.read"])
    await screen.findAllByText("IMP-01")
    const table = screen.getByRole("table")
    expect(within(table).getByRole("columnheader", { name: "Atributos" })).toBeInTheDocument()
    expect(within(table).getByText("PLA")).toBeInTheDocument()
    expect(within(table).getByText("PETG")).toBeInTheDocument()
    expect(within(table).getByText("256 mm")).toBeInTheDocument()
    expect(within(table).getByText("+1")).toBeInTheDocument()
  })

  it("opens a details sheet from the row name with attributes, and no link for unsafe URLs", async () => {
    const user = userEvent.setup()
    renderPage(["inventory.assets.read"])
    await screen.findAllByText("IMP-01")
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "Impressora Sala 2" }))

    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByText("Materiais")).toBeInTheDocument()
    expect(within(sheet).getByText("256 × 300 mm")).toBeInTheDocument()
    expect(within(sheet).getByText("javascript:alert(1)")).toBeInTheDocument()
    expect(within(sheet).queryByRole("link")).not.toBeInTheDocument()
    expect(within(sheet).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
  })

  it("offers an Editar button in the sheet when the user can write", async () => {
    const user = userEvent.setup()
    renderPage(["inventory.assets.read", "inventory.assets.write"])
    await screen.findAllByText("IMP-01")
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "Impressora Sala 2" }))
    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByRole("button", { name: "Editar" })).toBeInTheDocument()
  })

  it("keeps Detalhes and Editar in the row menu", async () => {
    const user = userEvent.setup()
    renderPage(["inventory.assets.read", "inventory.assets.write"])
    await screen.findAllByText("IMP-01")
    await user.click(
      within(screen.getByRole("table")).getByRole("button", {
        name: i18n.t("assets.inventory.actions.rowMenu", { tag: "IMP-01" }),
      }),
    )
    expect(await screen.findByRole("menuitem", { name: "Detalhes" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument()
  })

  it("shows the family title for a single family and a neutral header for several", async () => {
    const view = renderPage(["inventory.assets.read"])
    expect(await screen.findByRole("heading", { name: "Bens" })).toBeInTheDocument()
    expect(screen.getByText(/Bens e itens/)).toBeInTheDocument()
    view.unmount()

    profile.families = ["goods", "printer_3d", "scanner_3d"]
    renderPage(["inventory.assets.read"])
    const neutral = await screen.findByRole("heading", { name: "Recursos" })
    expect(neutral).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Bens" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Bens e itens/)).not.toBeInTheDocument()
    expect(screen.getByText("Cadastre os recursos deste negócio e organize-os por tipo.")).toBeInTheDocument()
  })
})
