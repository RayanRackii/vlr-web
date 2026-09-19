import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import i18n from "@/lib/i18n"
import { basePlanJson, CATEGORY_ID, PLAN_ID } from "@/features/pmoc/test/pmocFixtures"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({
  listPlanAssetCategories: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getPlans: vi.fn(),
}))

import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import { getPlans } from "@/features/pmoc/services/pmocService"

const getPlansMock = vi.mocked(getPlans)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)

describe("MaintenancePlansPage Phase 1 list", () => {
  beforeEach(() => {
    getPlansMock.mockReset()
    listCategoriesMock.mockReset()
    getPlansMock.mockResolvedValue([
      {
        ...basePlanJson,
        originKind: "Custom",
        autoGenerateEnabled: true,
      },
    ])
    listCategoriesMock.mockResolvedValue([{ id: CATEGORY_ID, name: "Split" }])
  })

  it("shows origin and auto columns and navigates to plan detail on row click", async () => {
    render(
      <MemoryRouter>
        <MaintenancePlansPage />
      </MemoryRouter>,
    )

    const row = await screen.findByTestId("plan-row")
    expect(row.textContent).toContain(basePlanJson.name)
    expect(row.textContent).toContain(i18n.t("pmoc.plans.origin.Custom"))
    expect(row.textContent).toContain(i18n.t("pmoc.plans.autoGenerateOn"))

    const planLink = row.querySelector("a")
    expect(planLink).toHaveAttribute("href", `/pmoc/${PLAN_ID}`)
  })

  it("H6: plan list does not show coverage aggregates", async () => {
    const { container } = render(
      <MemoryRouter>
        <MaintenancePlansPage />
      </MemoryRouter>,
    )

    await screen.findByTestId("plan-row")
    expect(screen.queryByTestId("plan-coverage")).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Nunca executados|Ativos elegíveis/i)
  })
})
