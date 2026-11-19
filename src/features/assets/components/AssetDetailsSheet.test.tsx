import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Asset } from "@/features/assets/schemas/assetSchemas"
import { getAssetProfile } from "@/features/planning/services/planningService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { renderWithQuery } from "@/test/renderWithQuery"
import { AssetDetailsSheet } from "./AssetDetailsSheet"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/planning/services/planningService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/planning/services/planningService")>()),
  getAssetProfile: vi.fn(),
  putAssetProfile: vi.fn(),
}))

const asset = {
  id: "a1", name: "Impressora 3D", tag: "IMP-1", categoryName: "Impressoras", location: "Sala 2", status: "Available", familyId: "f1", attributes: {},
} as unknown as Asset & { categoryName: string }

function access(modules: string[], granted: string[]) {
  vi.mocked(usePermissions).mockReturnValue({
    activeModules: modules, permissions: granted, can: (key) => granted.includes(key), isLoading: false,
    currentUser: { id: "u-1", tenantId: "t1" } as never, error: null, refresh: vi.fn(),
  })
}

const onOpenChange = vi.fn()
const show = () => renderWithQuery(<AssetDetailsSheet asset={asset} family={null} open onOpenChange={onOpenChange} />)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssetProfile).mockResolvedValue({
    assetId: "a1", isConfigured: false, isPlannable: false, isRentalBacked: false, capacity: 1, hoursPolicy: "",
    defaultPrepMinutes: 0, defaultCleanupMinutes: 0, workingHours: [],
  })
})

describe("AssetDetailsSheet availability", () => {
  it("offers the availability settings with the module active and the write permission", async () => {
    const user = userEvent.setup()
    access(["inventory", "resource-planning"], ["resource-planning.availability.write"])
    show()
    expect(screen.getByRole("heading", { name: "Disponibilidade" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Configurar disponibilidade" }))
    // The sheet steps aside for the dialog.
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(getAssetProfile).toHaveBeenCalledWith("a1"))
    expect(await screen.findByText("Disponibilidade para planejamento")).toBeInTheDocument()
    expect(await screen.findByRole("switch", { name: "Planejável" })).not.toBeChecked()
  })

  it("hides it when the module is not active", () => {
    access(["inventory"], ["resource-planning.availability.write"])
    show()
    expect(screen.queryByText("Disponibilidade")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Configurar disponibilidade" })).not.toBeInTheDocument()
  })

  it("hides it without the write permission, even with the module active", () => {
    access(["inventory", "resource-planning"], ["resource-planning.agenda.read", "inventory.assets.write"])
    show()
    expect(screen.queryByRole("button", { name: "Configurar disponibilidade" })).not.toBeInTheDocument()
    expect(getAssetProfile).not.toHaveBeenCalled()
  })
})
