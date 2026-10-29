import userEvent from "@testing-library/user-event"
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { ModuleIntroLinksProvider } from "@/components/layout/ModuleIntroLinksContext"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import { basePlanJson, CATEGORY_ID, PLAN_ID } from "@/features/pmoc/test/pmocFixtures"

const authSession = vi.hoisted(() => ({ access_token: "test" }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
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
        <TestPermissionProvider
          permissions={["pmoc.plans.read", "pmoc.plans.write"]}
          activeModules={["pmoc"]}
        >
          <MaintenancePlansPage />
        </TestPermissionProvider>
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
        <TestPermissionProvider
          permissions={["pmoc.plans.read"]}
          activeModules={["pmoc"]}
        >
          <MaintenancePlansPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )

    await screen.findByTestId("plan-row")
    expect(screen.queryByTestId("plan-coverage")).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Nunca executados|Ativos elegíveis/i)
  })
})

describe("MaintenancePlansPage empty states", () => {
  beforeEach(() => {
    getPlansMock.mockReset().mockResolvedValue([])
    listCategoriesMock.mockReset().mockResolvedValue([])
  })

  it.each([true, false])("uses the library when its permission is available (%s)", async (hasLibrary) => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={["/pmoc"]}><TestPermissionProvider
      permissions={["pmoc.plans.read", "pmoc.plans.write", ...(hasLibrary ? ["pmoc.templates.read"] : [])]}
      activeModules={["pmoc"]}
    ><ModuleIntroLinksProvider keys={["pmoc"]}><Routes>
      <Route path="/pmoc" element={<MaintenancePlansPage />} />
      <Route path="/pmoc/biblioteca" element={<div>plan-library</div>} />
      <Route path="/pmoc/novo" element={<div>custom-plan</div>} />
    </Routes></ModuleIntroLinksProvider></TestPermissionProvider></MemoryRouter>)
    await screen.findByText(i18n.t("pmoc.plans.empty"))
    expect(screen.getByText(i18n.t("emptyStates.examples.pmoc"))).toBeVisible()
    expect(screen.getByRole("link", { name: i18n.t("emptyStates.learnMore") })).toHaveAttribute("href", "/modulos/pmoc")
    const empty = screen.getByText(i18n.t("pmoc.plans.empty")).closest('[data-slot="empty-state"]') as HTMLElement
    const action = within(empty).getByRole("button", { name: i18n.t(hasLibrary ? "nav.pmocLibrary" : "nav.pmocNew") })
    await user.click(action)
    expect(await screen.findByText(hasLibrary ? "plan-library" : "custom-plan")).toBeVisible()
  })

  it("does not offer plan creation to readers", async () => {
    render(<MemoryRouter><TestPermissionProvider permissions={["pmoc.plans.read"]} activeModules={["pmoc"]}><MaintenancePlansPage /></TestPermissionProvider></MemoryRouter>)
    await screen.findByText(i18n.t("pmoc.plans.empty"))
    expect(screen.queryByRole("button", { name: i18n.t("nav.pmocNew") })).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("emptyStates.examples.pmoc"))).not.toBeInTheDocument()
  })
})
