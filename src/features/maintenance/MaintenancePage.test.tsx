import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { basePlanJson } from "@/features/pmoc/test/pmocFixtures"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import { getPlans } from "@/features/pmoc/services/pmocService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { MaintenancePage } from "./MaintenancePage"
import i18n from "@/lib/i18n"
vi.mock("@/features/pmoc/services/pmocService", () => ({ getPlans: vi.fn() }))
vi.mock("@/features/workOrders/services/workOrdersService", () => ({ getWorkOrders: vi.fn() }))
const all = ["pmoc.plans.read", "pmoc.templates.read", "pmoc.plans.write", "os.work_orders.read", "os.work_orders.create"]
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function mount(permissions = all, entry = "/manutencao", modules = ["pmoc", "os"]) {
  return render(<MemoryRouter initialEntries={[entry]}><TestPermissionProvider permissions={permissions} activeModules={modules}>
    <Routes><Route path="/manutencao" element={<MaintenancePage />} /><Route path="/manutencao/ordens/nova" element={<h1>Create order page</h1>} /></Routes><Location />
  </TestPermissionProvider></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlans).mockResolvedValue([{ ...basePlanJson, firstDueDate: "2000-01-01" }])
  vi.mocked(getWorkOrders).mockResolvedValue([makeWorkOrder()])
})
it("composes Hoje with one H1, compact badges, and a full-page generate link", async () => {
  const user = userEvent.setup(); mount()
  expect(await screen.findByText(basePlanJson.name)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: i18n.t("nav.pmocLibrary") })).toHaveAttribute("href", "/pmoc/biblioteca")
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("nav.manutencao"))
  expect(screen.getByRole("link", { name: i18n.t("maintenance.generate") })).toHaveAttribute("href", `/manutencao/ordens/nova?plano=${basePlanJson.id}`)
  expect(screen.getByText(i18n.t("maintenance.due"))).not.toHaveClass("w-full", "flex-1")
  await user.click(screen.getByRole("link", { name: i18n.t("maintenance.generate") }))
  expect(screen.getByRole("heading", { name: "Create order page" })).toBeInTheDocument()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
it.each([
  ["pmoc.plans.read", "planos", "ordens"], ["os.work_orders.read", "ordens", "planos"],
])("only loads permitted data and hides create actions for %s", async (permission, visible, hidden) => {
  mount([permission], `/manutencao?aba=${hidden}`)
  await waitFor(() => expect(screen.queryByText(i18n.t("maintenance.loading"))).not.toBeInTheDocument())
  expect(screen.getByRole("tab", { name: i18n.t(`maintenance.tabs.${visible}`) })).toBeInTheDocument()
  expect(screen.queryByRole("tab", { name: i18n.t(`maintenance.tabs.${hidden}`) })).not.toBeInTheDocument()
  expect(permission === "pmoc.plans.read" ? getWorkOrders : getPlans).not.toHaveBeenCalled()
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newOrder") })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newPlan") })).not.toBeInTheDocument()
  expect(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.hoje") })).toHaveAttribute("aria-selected", "true")
})
it("switches URL tabs, resets filters, and changes the sole primary action", async () => {
  const user = userEvent.setup(); mount(); await screen.findByText(basePlanJson.name)
  await user.click(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.planos") }))
  expect(screen.getByTestId("location")).toHaveTextContent("aba=planos")
  expect(screen.getByRole("link", { name: i18n.t("maintenance.newPlan") })).toHaveAttribute("href", "/manutencao/planos/novo")
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newOrder") })).not.toBeInTheDocument()
  await user.type(screen.getByRole("searchbox"), "no-match")
  expect(screen.getByRole("tabpanel")).toHaveTextContent(i18n.t("maintenance.emptyTitle"))
  await user.click(screen.getByRole("button", { name: i18n.t("maintenance.clear") }))
  expect(screen.getByText(basePlanJson.name)).toBeInTheDocument()
})
it("offers library-only access without fetching plans or orders", async () => {
  mount(["pmoc.templates.read"])
  expect(await screen.findByRole("link", { name: i18n.t("nav.pmocLibrary") })).toHaveAttribute("href", "/pmoc/biblioteca")
  expect(getPlans).not.toHaveBeenCalled(); expect(getWorkOrders).not.toHaveBeenCalled()
  expect(screen.queryByRole("tab", { name: i18n.t("maintenance.tabs.planos") })).not.toBeInTheDocument()
})
it("keeps a successful source when the other fails and retries", async () => {
  vi.mocked(getWorkOrders).mockRejectedValueOnce(new Error("Orders unavailable"))
  const user = userEvent.setup(); mount()
  expect(await screen.findByText(basePlanJson.name)).toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent("Orders unavailable")
  await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
})

it("filters with popovers and supports keyboard navigation between URL tabs", async () => {
  const user = userEvent.setup(); mount(); await screen.findByText(basePlanJson.name)
  await user.click(screen.getByRole("button", { name: `${i18n.t("maintenance.type")} +` }))
  await user.click(screen.getByRole("button", { name: i18n.t("maintenance.tabs.ordens") }))
  expect(screen.queryByText(basePlanJson.name)).not.toBeInTheDocument()
  await user.keyboard("{Escape}")
  const todayTab = screen.getByRole("tab", { name: i18n.t("maintenance.tabs.hoje") })
  todayTab.focus(); await user.keyboard("{End}")
  expect(screen.getByTestId("location")).toHaveTextContent("aba=planos")
  expect(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.planos") })).toHaveFocus()
  expect(screen.getByText(basePlanJson.name)).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: `${i18n.t("maintenance.status")} +` }))
  expect(screen.getByRole("button", { name: i18n.t("pmoc.plans.status.active") })).toBeInTheDocument()
})
it("excludes inactive or future-first-date plans and finished orders from Hoje", async () => {
  vi.mocked(getPlans).mockResolvedValue([
    { ...basePlanJson, id: "due", name: "Due plan", firstDueDate: "2000-01-01" },
    { ...basePlanJson, id: "inactive", name: "Inactive plan", isActive: false },
    { ...basePlanJson, id: "future", name: "Future plan", firstDueDate: "2999-01-01" },
  ])
  vi.mocked(getWorkOrders).mockResolvedValue([makeWorkOrder({ status: "Completed" }), makeWorkOrder({ id: "canceled", status: "Canceled" })])
  mount()
  expect(await screen.findByText("Due plan")).toBeInTheDocument()
  expect(screen.queryByText("Inactive plan")).not.toBeInTheDocument()
  expect(screen.queryByText("Future plan")).not.toBeInTheDocument()
  expect(screen.queryByText(i18n.t("workOrders.status.Completed"))).not.toBeInTheDocument()
  expect(screen.queryByText(i18n.t("workOrders.status.Canceled"))).not.toBeInTheDocument()
})
