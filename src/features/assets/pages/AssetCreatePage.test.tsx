import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetCreatePage } from "@/features/assets/pages/AssetCreatePage"
import i18n from "@/lib/i18n"

const trial = vi.hoisted(() => ({ isTrialReadOnly: false }))

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({ isTrialReadOnly: trial.isTrialReadOnly }),
}))

vi.mock("@/features/users/permissions/PermissionContext", () => ({
  usePermissions: () => ({ can: () => true }),
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(),
}))

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listActiveAssetFamilies: vi.fn(),
}))

import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { listActiveAssetFamilies } from "@/features/assets/services/assetFamiliesService"
import { getUnits } from "@/features/assets/services/unitsService"

const getUnitsMock = vi.mocked(getUnits)
const getCategoriesMock = vi.mocked(getCategories)
const listFamiliesMock = vi.mocked(listActiveAssetFamilies)

describe("AssetCreatePage", () => {
  beforeEach(() => {
    trial.isTrialReadOnly = false
    getUnitsMock.mockReset()
    getCategoriesMock.mockReset()
    listFamiliesMock.mockReset()
  })

  it("shows the load error instead of an empty wizard", async () => {
    getUnitsMock.mockRejectedValue(new Error("falhou"))
    getCategoriesMock.mockResolvedValue([])
    listFamiliesMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <AssetCreatePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("falhou")
    expect(screen.queryByRole("button", { name: i18n.t("assets.wizard.next") })).not.toBeInTheDocument()
  })

  it("keeps a trial session from finishing the create page", async () => {
    trial.isTrialReadOnly = true
    getUnitsMock.mockResolvedValue([])
    getCategoriesMock.mockResolvedValue([])
    listFamiliesMock.mockResolvedValue([])

    render(
      <MemoryRouter>
        <AssetCreatePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("status")).toHaveTextContent(i18n.t("trial.readOnlyHint"))
    expect(screen.getByRole("button", { name: i18n.t("assets.wizard.next") })).toBeEnabled()
    expect(screen.queryByRole("button", { name: i18n.t("assets.wizard.finish") })).not.toBeInTheDocument()
  })
})
