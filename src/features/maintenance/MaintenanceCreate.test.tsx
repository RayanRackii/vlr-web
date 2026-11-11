import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { MaintenanceCreateOrderPage, MaintenanceCreatePlanPage } from "./MaintenanceRoutes"
import { getPlan } from "@/features/pmoc/services/pmocService"
import { getTechnicians } from "@/features/users/services/usersService"
import { createWorkOrder, generateWorkOrderFromPlan, listWorkOrderAssets } from "@/features/workOrders/services/workOrdersService"
import { basePlanJson } from "@/features/pmoc/test/pmocFixtures"
import { matchingRegistryAsset, otherUnitRegistryAsset, inactiveRegistryAsset, scheduledDeletionRegistryAsset, makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import i18n from "@/lib/i18n"
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ session: { access_token: "test" } }) }))
vi.mock("@/features/pmoc/services/pmocService", () => ({ getPlan: vi.fn(), createPlan: vi.fn() }))
vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({ listPlanAssetCategories: vi.fn().mockResolvedValue([]) }))
vi.mock("@/features/assets/services/unitsService", () => ({ getUnits: vi.fn().mockResolvedValue([]) }))
vi.mock("@/features/users/services/usersService", () => ({ getTechnicians: vi.fn() }))
vi.mock("@/features/workOrders/services/workOrdersService", () => ({ listWorkOrderAssets: vi.fn(), createWorkOrder: vi.fn(), generateWorkOrderFromPlan: vi.fn() }))
function mount(entry: string, plan = false) {
  return render(<MemoryRouter initialEntries={[entry]}><TestPermissionProvider activeModules={["pmoc", "os"]} permissions={["pmoc.plans.read", "pmoc.plans.write", "os.work_orders.create"]}>{plan ? <MaintenanceCreatePlanPage /> : <MaintenanceCreateOrderPage />}</TestPermissionProvider></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlan).mockResolvedValue(basePlanJson)
  vi.mocked(listWorkOrderAssets).mockResolvedValue([matchingRegistryAsset, otherUnitRegistryAsset, inactiveRegistryAsset, scheduledDeletionRegistryAsset])
  vi.mocked(getTechnicians).mockResolvedValue([])
  vi.mocked(generateWorkOrderFromPlan).mockResolvedValue(makeWorkOrder())
})
it("generates from a plan on the full page using only eligible equipment and the existing endpoint", async () => {
  const user = userEvent.setup(); mount(`/manutencao/ordens/nova?plano=${basePlanJson.id}`)
  expect(await screen.findByRole("heading", { level: 1, name: i18n.t("maintenance.generate") })).toBeInTheDocument()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(i18n.t("workOrders.create.form.task"))).not.toBeInTheDocument()
  expect(screen.getByText(basePlanJson.tasks[0].title)).toBeInTheDocument()
  const submit = await screen.findByRole("button", { name: i18n.t("workOrders.create.submit") })
  expect(submit).toBeDisabled()
  const assetPicker = screen.getByRole("combobox", { name: i18n.t("workOrders.create.form.asset") })
  await waitFor(() => expect(assetPicker).toBeEnabled())
  await user.click(assetPicker)
  expect(await screen.findAllByRole("option")).toHaveLength(1)
  await user.click(await screen.findByRole("option", { name: `${matchingRegistryAsset.tag} — ${matchingRegistryAsset.name}` }))
  expect(submit).toBeEnabled()
  await user.click(submit)
  await waitFor(() => expect(generateWorkOrderFromPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: basePlanJson.id, assetId: matchingRegistryAsset.id })))
  expect(createWorkOrder).not.toHaveBeenCalled()
  expect(submit).toBeDisabled()
})
it("preserves the form and API error when generation fails", async () => {
  vi.mocked(generateWorkOrderFromPlan).mockRejectedValue(new Error("Duplicate order"))
  const user = userEvent.setup(); mount(`/manutencao/ordens/nova?plano=${basePlanJson.id}`)
  const assetPicker = await screen.findByRole("combobox", { name: i18n.t("workOrders.create.form.asset") })
  await waitFor(() => expect(assetPicker).toBeEnabled())
  await user.click(assetPicker)
  await user.click(await screen.findByRole("option", { name: `${matchingRegistryAsset.tag} — ${matchingRegistryAsset.name}` }))
  await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate order")
  expect(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") })).toBeEnabled()
})
it("keeps the real create plan form on a page with one H1", async () => {
  mount("/manutencao/planos/novo", true)
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await screen.findByText(i18n.t("pmoc.create.emptyCategoriesTitle"))
})
