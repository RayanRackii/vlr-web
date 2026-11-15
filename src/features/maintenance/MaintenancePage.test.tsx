import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { basePlanJson } from "@/features/pmoc/test/pmocFixtures"
import type { MaintenancePlanCoverage } from "@/features/pmoc/schemas/coverageSchemas"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import { getPlanCoverage, getPlans } from "@/features/pmoc/services/pmocService"
import { generateWorkOrderFromPlan, getWorkOrders } from "@/features/workOrders/services/workOrdersService"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { MaintenancePage } from "./MaintenancePage"
import { addCivilDays } from "./agendaModel"
import i18n from "@/lib/i18n"
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/pmoc/services/pmocService", () => ({ getPlans: vi.fn(), getPlanCoverage: vi.fn() }))
vi.mock("@/features/workOrders/services/workOrdersService", async importOriginal => ({ ...await importOriginal<typeof import("@/features/workOrders/services/workOrdersService")>(), getWorkOrders: vi.fn(), generateWorkOrderFromPlan: vi.fn() }))
const all = ["pmoc.plans.read", "pmoc.templates.read", "pmoc.plans.write", "os.work_orders.read", "os.work_orders.create"]
const USER_ID = "77777777-7777-4777-8777-777777777777"
const today = tenantTodayIsoDate("America/Sao_Paulo")
const ASSET_A = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"
const ASSET_B = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2"
function coverage(planId: string, assets: { assetId: string; name: string; tag: string; due: string; open?: boolean }[]): MaintenancePlanCoverage {
  return {
    planId, asOfDate: today, intervalDays: 30, firstDueDate: "2026-01-01", isActive: true, autoGenerateEnabled: false, wouldBeConsideredByGenerator: true, eligibleAssetCount: assets.length,
    summary: { eligibleAssets: assets.length, assetsNeverExecuted: 0, assetsExecuted: assets.length, assetsNotDue: 0, assetsDueToday: 0, assetsOverdue: assets.length, assetsNeedingAttention: assets.length, assetsWithOpenWorkOrder: 0 },
    assets: assets.map(asset => ({ assetId: asset.assetId, name: asset.name, tag: asset.tag, historyStatus: "Executed" as const, lastMaintenance: null, effectiveNextDueDate: asset.due, dueStatus: "Overdue" as never, needsAttention: true,
      openWorkOrder: asset.open ? { workOrderId: "99999999-9999-4999-8999-999999999999", status: "Pending" as const, scheduledDate: today } : null })),
  }
}
const names = (name: string) => screen.queryAllByText(name)
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function mount(permissions = all, entry = "/manutencao", modules = ["pmoc", "os"], withUser = true) {
  const currentUser = withUser ? { id: USER_ID, fullName: "Eu", email: "eu@example.com", role: "USER" as const, tenantId: null, activeModules: modules, activeAssetFamilies: [], isTrial: false, isTrialReadOnly: false, notificationsEmailOnly: false, roles: [], permissions } : null
  return render(<MemoryRouter initialEntries={[entry]}><TestPermissionProvider permissions={permissions} activeModules={modules} currentUser={currentUser}>
    <Routes><Route path="/manutencao" element={<MaintenancePage />} /><Route path="/manutencao/ordens/nova" element={<h1>Create order page</h1>} /></Routes><Location />
  </TestPermissionProvider></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlans).mockResolvedValue([basePlanJson])
  vi.mocked(getPlanCoverage).mockResolvedValue(coverage(basePlanJson.id, [{ assetId: ASSET_A, name: "Split sala 1", tag: "AC-01", due: addCivilDays(today, -10) }]))
  vi.mocked(getWorkOrders).mockResolvedValue([makeWorkOrder({ scheduledDate: addCivilDays(today, 20) })])
})
it("groups the Agenda into overdue and upcoming with human titles, badges and a Gerar OS link", async () => {
  const user = userEvent.setup(); mount()
  expect(await screen.findByRole("heading", { level: 2, name: i18n.t("maintenance.sections.overdue") })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: i18n.t("maintenance.sections.upcoming") })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { level: 2, name: i18n.t("maintenance.sections.week") })).not.toBeInTheDocument()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.getByRole("link", { name: i18n.t("nav.pmocLibrary") })).toHaveAttribute("href", "/pmoc/biblioteca")
  const overdue = screen.getAllByRole("table")[0]
  expect(within(overdue).getByText(i18n.t("maintenance.overdueDays", { count: 10 }))).toBeInTheDocument()
  expect(within(overdue).getByText(i18n.t("maintenance.needsOrder"))).toBeInTheDocument()
  expect(within(overdue).getByRole("link", { name: i18n.t("maintenance.generate") })).toHaveAttribute("href", `/manutencao/ordens/nova?plano=${basePlanJson.id}`)
  const upcoming = screen.getAllByRole("table")[1]
  expect(within(upcoming).getByRole("link", { name: /Split sala 1/ })).toHaveAttribute("href", "/os/99999999-9999-4999-8999-999999999999")
  // Flex drops the whitespace text node between name and tag; the gap keeps them apart visually.
  expect(within(upcoming).getByRole("link", { name: /Split sala 1/ })).toHaveClass("gap-1.5")
  expect(within(upcoming).getByText(i18n.t("maintenance.noTechnician"))).toBeInTheDocument()
  expect(document.body).not.toHaveTextContent(/\b\d{4}-\d{2}-\d{2}\b/)
  expect(document.body).not.toHaveTextContent("99999999")
  await user.click(within(overdue).getByRole("link", { name: i18n.t("maintenance.generate") }))
  expect(screen.getByRole("heading", { name: "Create order page" })).toBeInTheDocument()
})
it("does not use the plan first due date: an executed plan with nothing due shows nothing", async () => {
  vi.mocked(getPlans).mockResolvedValue([{ ...basePlanJson, firstDueDate: "2000-01-01" }])
  vi.mocked(getPlanCoverage).mockResolvedValue(coverage(basePlanJson.id, []))
  vi.mocked(getWorkOrders).mockResolvedValue([])
  mount()
  expect(await screen.findByText(i18n.t("maintenance.emptyTitle"))).toBeInTheDocument()
  expect(names(basePlanJson.name)).toHaveLength(0)
})
it("hides assets that already have an open OS and finished orders", async () => {
  vi.mocked(getPlanCoverage).mockResolvedValue(coverage(basePlanJson.id, [{ assetId: ASSET_A, name: "Com OS aberta", tag: "AC-07", due: addCivilDays(today, -3), open: true }]))
  vi.mocked(getWorkOrders).mockResolvedValue([makeWorkOrder({ status: "Completed" }), makeWorkOrder({ id: "88888888-8888-4888-8888-888888888881", status: "Canceled" })])
  mount()
  expect(await screen.findByText(i18n.t("maintenance.emptyTitle"))).toBeInTheDocument()
  expect(names("Com OS aberta")).toHaveLength(0)
})
it("keeps other plans when one coverage call fails and says the agenda may be incomplete", async () => {
  vi.mocked(getPlans).mockResolvedValue([basePlanJson, { ...basePlanJson, id: "22222222-2222-4222-8222-222222222222", name: "Plano B" }])
  vi.mocked(getPlanCoverage).mockImplementation(async id => {
    if (id === basePlanJson.id) return coverage(id, [{ assetId: ASSET_A, name: "Split sala 1", tag: "AC-01", due: addCivilDays(today, -2) }])
    throw new Error("boom")
  })
  mount()
  expect(await screen.findAllByText("Split sala 1")).not.toHaveLength(0)
  expect(screen.getByText(i18n.t("maintenance.coverageFailed", { count: 1 }))).toBeInTheDocument()
})
it("accepts the legacy hoje tab value and renames the tab to Agenda", async () => {
  mount(all, "/manutencao?aba=hoje")
  expect(await screen.findByRole("tab", { name: i18n.t("maintenance.tabs.agenda") })).toHaveAttribute("aria-selected", "true")
  expect(i18n.t("maintenance.tabs.agenda", { lng: "pt-BR" })).toBe("Agenda")
})
it("filters the Agenda with Atrasadas, Sem técnico and Minhas chips", async () => {
  const user = userEvent.setup()
  vi.mocked(getWorkOrders).mockResolvedValue([
    makeWorkOrder({ id: "88888888-8888-4888-8888-888888888801", scheduledDate: addCivilDays(today, -1), asset: { ...makeWorkOrder().asset, name: "Chiller late", tag: "CH-1" } }),
    makeWorkOrder({ id: "88888888-8888-4888-8888-888888888802", scheduledDate: addCivilDays(today, 2), assignedUserId: USER_ID, assignedUser: { id: USER_ID, fullName: "Eu", email: "eu@example.com" }, asset: { ...makeWorkOrder().asset, name: "Bomba minha", tag: "BM-1" } }),
  ])
  mount(); await screen.findAllByText("Chiller late")
  await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("maintenance.agendaFilters.mine")) }))
  expect(names("Bomba minha")).not.toHaveLength(0); expect(names("Chiller late")).toHaveLength(0)
  await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("maintenance.agendaFilters.unassigned")) }))
  expect(names("Chiller late")).not.toHaveLength(0); expect(names("Bomba minha")).toHaveLength(0)
  await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("maintenance.agendaFilters.overdue")) }))
  expect(names("Chiller late")).not.toHaveLength(0); expect(names("Split sala 1")).not.toHaveLength(0)
  expect(names("Bomba minha")).toHaveLength(0)
})
it("hides the Minhas chip when the current user is unknown", async () => {
  mount(all, "/manutencao", ["pmoc", "os"], false); await screen.findAllByText("Split sala 1")
  expect(screen.queryByRole("button", { name: new RegExp(i18n.t("maintenance.agendaFilters.mine")) })).not.toBeInTheDocument()
})
it("generates overdue OS sequentially after confirmation and reports a summary", async () => {
  const user = userEvent.setup()
  vi.mocked(getPlanCoverage).mockResolvedValue(coverage(basePlanJson.id, [
    { assetId: ASSET_A, name: "Split sala 1", tag: "AC-01", due: addCivilDays(today, -10) },
    { assetId: ASSET_B, name: "Split sala 2", tag: "AC-02", due: addCivilDays(today, -5) },
  ]))
  vi.mocked(generateWorkOrderFromPlan).mockResolvedValue(makeWorkOrder())
  mount()
  await user.click(await screen.findByRole("button", { name: i18n.t("maintenance.generateOverdue", { count: 2 }) }))
  expect(generateWorkOrderFromPlan).not.toHaveBeenCalled()
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: i18n.t("maintenance.generate") }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t("maintenance.bulkSummary", { created: 2, skipped: 0, failed: 0 })))
  expect(vi.mocked(generateWorkOrderFromPlan).mock.calls.map(call => call[0])).toEqual([
    { planId: basePlanJson.id, assetId: ASSET_A, assignedUserId: null, scheduledDate: today },
    { planId: basePlanJson.id, assetId: ASSET_B, assignedUserId: null, scheduledDate: today },
  ])
})
it("hides the bulk and per-row generate actions without os.work_orders.create", async () => {
  mount(all.filter(permission => permission !== "os.work_orders.create"))
  await screen.findAllByText("Split sala 1")
  expect(screen.queryByRole("button", { name: /Gerar OS atrasadas|Generate overdue/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.generate") })).not.toBeInTheDocument()
})
it.each([
  ["pmoc.plans.read", "planos", "ordens"], ["os.work_orders.read", "ordens", "planos"],
])("only loads permitted data and hides create actions for %s", async (permission, visible, hidden) => {
  mount([permission], `/manutencao?aba=${hidden}`)
  await waitFor(() => expect(screen.queryByRole("status", { name: i18n.t("maintenance.loading") })).not.toBeInTheDocument())
  expect(screen.getByRole("tab", { name: i18n.t(`maintenance.tabs.${visible}`) })).toBeInTheDocument()
  expect(screen.queryByRole("tab", { name: i18n.t(`maintenance.tabs.${hidden}`) })).not.toBeInTheDocument()
  expect(permission === "pmoc.plans.read" ? getWorkOrders : getPlans).not.toHaveBeenCalled()
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newOrder") })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newPlan") })).not.toBeInTheDocument()
  expect(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.agenda") })).toHaveAttribute("aria-selected", "true")
})
it("shows plans with interval and no per-row generate link, and resets filters on tab change", async () => {
  const user = userEvent.setup(); mount(); await screen.findAllByText("Split sala 1")
  await user.click(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.planos") }))
  expect(screen.getByTestId("location")).toHaveTextContent("aba=planos")
  expect(screen.getByRole("link", { name: i18n.t("maintenance.newPlan") })).toHaveAttribute("href", "/manutencao/planos/novo")
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.newOrder") })).not.toBeInTheDocument()
  expect(screen.getAllByText(i18n.t("maintenance.every", { count: 30 }))).not.toHaveLength(0)
  expect(screen.getAllByRole("link", { name: basePlanJson.name })[0]).toHaveAttribute("href", `/pmoc/${basePlanJson.id}`)
  expect(screen.queryByRole("link", { name: i18n.t("maintenance.generate") })).not.toBeInTheDocument()
  await user.type(screen.getByRole("searchbox"), "no-match")
  expect(screen.getByRole("tabpanel")).toHaveTextContent(i18n.t("maintenance.emptyTitle"))
  await user.click(screen.getByRole("button", { name: i18n.t("maintenance.clear") }))
  expect(screen.getAllByText(basePlanJson.name)).not.toHaveLength(0)
})
it("lists orders with equipment name, tag, technician column and human dates", async () => {
  mount(all, "/manutencao?aba=ordens")
  const link = (await screen.findAllByRole("link", { name: /Split sala 1/ }))[0]
  expect(link).toHaveTextContent("AC-01")
  expect(link).not.toHaveTextContent("9999")
  expect(screen.getByRole("columnheader", { name: i18n.t("maintenance.columns.technician") })).toBeInTheDocument()
  expect(document.body).not.toHaveTextContent(/\b\d{4}-\d{2}-\d{2}\b/)
})
it("offers library-only access without fetching plans or orders", async () => {
  mount(["pmoc.templates.read"])
  expect(await screen.findByRole("link", { name: i18n.t("nav.pmocLibrary") })).toHaveAttribute("href", "/pmoc/biblioteca")
  expect(getPlans).not.toHaveBeenCalled(); expect(getWorkOrders).not.toHaveBeenCalled(); expect(getPlanCoverage).not.toHaveBeenCalled()
  expect(screen.queryByRole("tab", { name: i18n.t("maintenance.tabs.planos") })).not.toBeInTheDocument()
})
it("keeps a successful source when the other fails and retries", async () => {
  vi.mocked(getWorkOrders).mockRejectedValueOnce(new Error("Orders unavailable"))
  const user = userEvent.setup(); mount()
  expect(await screen.findByRole("alert")).toHaveTextContent("Orders unavailable")
  expect(await screen.findAllByText("Split sala 1")).not.toHaveLength(0)
  await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
})
it("supports keyboard navigation between URL tabs", async () => {
  mount(); await screen.findAllByText("Split sala 1")
  const agendaTab = screen.getByRole("tab", { name: i18n.t("maintenance.tabs.agenda") })
  agendaTab.focus(); await userEvent.keyboard("{End}")
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("aba=planos"))
  expect(screen.getByRole("tab", { name: i18n.t("maintenance.tabs.planos") })).toHaveFocus()
})
