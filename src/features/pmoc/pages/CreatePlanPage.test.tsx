import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(async () => {
    throw new Error("must not call GET /api/asset-categories")
  }),
}))

vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({
  listPlanAssetCategories: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  createPlan: vi.fn(),
  getGlobalTemplates: vi.fn(),
}))

import { getUnits } from "@/features/assets/services/unitsService"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"

const getUnitsMock = vi.mocked(getUnits)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)

const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

describe("CreatePlanPage category picker", () => {
  beforeEach(() => {
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
    ])
  })

  it("shows guidance when there are no categories and never links to Ativos", async () => {
    listCategoriesMock.mockResolvedValue([])

    const { container } = render(
      <MemoryRouter>
        <CreatePlanPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText(i18n.t("pmoc.create.emptyCategoriesTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.create.emptyCategoriesDescription")),
    ).toBeInTheDocument()
    expect(listCategoriesMock).toHaveBeenCalled()
    expect(screen.queryByRole("link", { name: /ativos/i })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Ativos/)
    expect(container.textContent).not.toMatch(/Asset Registry/i)
  })
})
