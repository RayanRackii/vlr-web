import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { renderWithQuery } from "@/test/renderWithQuery"
import type { PlanningAgenda, PlanningAllocation } from "../schemas/planningSchemas"
import { PlanningApiError, getAssetProfile, getPlanningAgenda, listPlanningAssets, putAssetProfile } from "../services/planningService"
import { PlanningAgendaPage } from "./PlanningAgendaPage"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("../services/planningService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/planningService")>()),
  getPlanningAgenda: vi.fn(),
  listPlanningAssets: vi.fn(),
  getAssetProfile: vi.fn(),
  putAssetProfile: vi.fn(),
}))

const ZONE = "America/Sao_Paulo"
const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString()

const allocation = (over: Partial<PlanningAllocation> = {}): PlanningAllocation => ({
  id: "x1", assetId: "a1", assetName: "Impressora 3D", unitId: "u1", kind: "Use", title: "Peça A", notes: "", quantity: 1,
  plannedWorkStart: at("2026-11-18", "10:00"), plannedWorkEnd: at("2026-11-18", "12:00"), occupiedStart: at("2026-11-18", "10:00"), occupiedEnd: at("2026-11-18", "12:00"),
  timeZoneId: ZONE, status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: "u-1", cancelReason: "",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "AAAA", ...over,
})

const agenda = (items: PlanningAllocation[]): PlanningAgenda => ({
  from: at("2026-11-18", "00:00"), to: at("2026-11-19", "00:00"), items, externalBusy: [],
  resources: [
    { assetId: "a1", name: "Impressora 3D", tag: "IMP-1", unitId: "u1", unitName: "Sede", capacity: 1, hoursPolicy: "StartWithinHours", isRentalBacked: false, timeZoneId: ZONE,
      workingHours: [{ dayOfWeek: 3, openTime: "08:00:00", closeTime: "18:00:00" }] },
    { assetId: "a2", name: "Torno CNC", tag: "CNC-1", unitId: "u1", unitName: "Sede", capacity: 1, hoursPolicy: "Anytime", isRentalBacked: false, timeZoneId: ZONE, workingHours: [] },
  ],
})

function access(granted: string[]) {
  vi.mocked(usePermissions).mockReturnValue({
    activeModules: ["resource-planning"], permissions: granted, can: (key) => granted.includes(key), isLoading: false,
    currentUser: { id: "u-1", tenantId: "t1" } as never, error: null, refresh: vi.fn(),
  })
}

function visit(search = "?date=2026-11-18") {
  return renderWithQuery(
    <TenantTimeZoneContext.Provider value={ZONE}>
      <MemoryRouter initialEntries={[`/agendas/planejamento${search}`]}><PlanningAgendaPage /></MemoryRouter>
    </TenantTimeZoneContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  access(["resource-planning.agenda.read", "resource-planning.allocations.execute"])
  vi.mocked(getPlanningAgenda).mockResolvedValue(agenda([allocation()]))
  vi.mocked(listPlanningAssets).mockResolvedValue([])
})

describe("PlanningAgendaPage day view", () => {
  it("asks for the tenant-zone day and draws one row per asset with the allocation", async () => {
    visit()
    expect(await screen.findByRole("heading", { level: 1, name: "Planejamento" })).toBeInTheDocument()
    await waitFor(() => expect(getPlanningAgenda).toHaveBeenCalledWith({ from: "2026-11-18T03:00:00.000Z", to: "2026-11-19T03:00:00.000Z" }))
    const rows = await screen.findAllByTestId("planning-row")
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText("Impressora 3D")).toBeInTheDocument()
    expect(within(rows[0]).getByRole("button", { name: /Peça A, 10:00 – 12:00, Agendada/ })).toBeInTheDocument()
    expect(within(rows[1]).queryByRole("button", { name: /Peça A/ })).not.toBeInTheDocument()
  })

  it("shades non-working time only for assets with an hours rule", async () => {
    visit()
    const rows = await screen.findAllByTestId("planning-row")
    expect(within(rows[0]).getAllByTestId("planning-closed")).toHaveLength(2)
    expect(within(rows[1]).queryAllByTestId("planning-closed")).toHaveLength(0)
  })

  it("flags overdue and expired allocations in words, not only colour", async () => {
    vi.mocked(getPlanningAgenda).mockResolvedValue(agenda([
      allocation({ id: "late", title: "Atrasada A", status: "Running", isOverdue: true, actualStartAt: at("2026-11-18", "10:00") }),
      allocation({ id: "old", title: "Velha B", isExpired: true, isBlocking: false, assetId: "a2", plannedWorkStart: at("2026-11-18", "14:00"), plannedWorkEnd: at("2026-11-18", "15:00"), occupiedStart: at("2026-11-18", "14:00"), occupiedEnd: at("2026-11-18", "15:00") }),
    ]))
    visit()
    expect(await screen.findByRole("button", { name: /Atrasada A.*Atrasada/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Velha B.*Expirada/ })).toBeInTheDocument()
    expect(screen.getByText("1 atrasada")).toBeInTheDocument()
    expect(screen.getByText("1 expirada")).toBeInTheDocument()
  })

  it("opens the detail sheet from a block", async () => {
    visit()
    await userEvent.click(await screen.findByRole("button", { name: /Peça A, 10:00 – 12:00/ }))
    expect(await screen.findByRole("dialog")).toHaveTextContent("Peça A")
    expect(screen.getByRole("button", { name: /Iniciar uso/ })).toBeInTheDocument()
  })

  it("shows an empty state when no asset is plannable", async () => {
    vi.mocked(getPlanningAgenda).mockResolvedValue({ ...agenda([]), resources: [] })
    visit()
    expect(await screen.findByTestId("planning-empty")).toHaveTextContent("Nenhum recurso planejável")
  })

  it("shows the API failure in plain words with a retry", async () => {
    vi.mocked(getPlanningAgenda).mockRejectedValue(new PlanningApiError(403, "module_inactive", "x"))
    visit()
    expect(await screen.findByRole("alert")).toHaveTextContent("O módulo de Planejamento de recursos não está ativo")
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument()
  })

  it("scrolls the timeline inside its own container", async () => {
    visit()
    const grid = await screen.findByTestId("planning-day-grid")
    expect(grid.className).toContain("overflow-x-auto")
  })
})

describe("PlanningAgendaPage creation entry points", () => {
  it("offers New allocation to a technician and opens the dialog", async () => {
    visit()
    await userEvent.click(await screen.findByRole("button", { name: /Nova alocação/ }))
    expect(await screen.findByRole("dialog", { name: "Nova alocação" })).toBeInTheDocument()
  })

  it("hides the creation button from a reader", async () => {
    access(["resource-planning.agenda.read"])
    visit()
    await screen.findAllByTestId("planning-row")
    expect(screen.queryByRole("button", { name: /Nova alocação/ })).not.toBeInTheDocument()
  })
})

describe("PlanningAgendaPage week view", () => {
  it("asks for the whole Monday to Sunday range and lists the allocation on its day", async () => {
    visit("?date=2026-11-18&visao=semana")
    await waitFor(() => expect(getPlanningAgenda).toHaveBeenCalledWith({ from: "2026-11-16T03:00:00.000Z", to: "2026-11-23T03:00:00.000Z" }))
    const cells = await screen.findAllByTestId("planning-week-cell")
    expect(cells).toHaveLength(14)
    expect(within(cells[2]).getByRole("button", { name: /Peça A/ })).toBeInTheDocument()
    expect(within(cells[0]).queryByRole("button", { name: /Peça A/ })).not.toBeInTheDocument()
  })

  it("marks days an asset is closed all day", async () => {
    visit("?date=2026-11-18&visao=semana")
    const cells = await screen.findAllByTestId("planning-week-cell")
    expect(within(cells[0]).getByText("Fora do horário")).toBeInTheDocument()
    expect(within(cells[1 + 6]).queryByText("Fora do horário")).not.toBeInTheDocument()
  })
})

describe("availability from the agenda", () => {
  const loadedProfile = { assetId: "a1", isConfigured: true, isPlannable: true, isRentalBacked: false, capacity: 1, hoursPolicy: "StartWithinHours", defaultPrepMinutes: 0, defaultCleanupMinutes: 0, workingHours: [{ dayOfWeek: 3, openTime: "08:00", closeTime: "18:00" }] }

  beforeEach(() => {
    vi.mocked(getAssetProfile).mockResolvedValue(loadedProfile)
    vi.mocked(putAssetProfile).mockResolvedValue(loadedProfile)
  })

  it("keeps the resource names plain text without the availability permission", async () => {
    visit()
    expect(await screen.findByText("Impressora 3D")).toBeInTheDocument()
    expect(screen.queryByTestId("planning-row-label")).not.toBeInTheDocument()
  })

  it("does not offer it when the module is not active", async () => {
    vi.mocked(usePermissions).mockReturnValue({
      activeModules: [], permissions: [], can: () => true, isLoading: false,
      currentUser: { id: "u-1", tenantId: "t1" } as never, error: null, refresh: vi.fn(),
    })
    visit()
    expect(await screen.findByText("Impressora 3D")).toBeInTheDocument()
    expect(screen.queryByTestId("planning-row-label")).not.toBeInTheDocument()
  })

  it("opens the settings from a resource label and reloads the agenda shading after saving", async () => {
    access(["resource-planning.agenda.read", "resource-planning.availability.write"])
    const user = userEvent.setup()
    visit()
    const label = await screen.findByRole("button", { name: "Configurar disponibilidade de Impressora 3D" })
    await waitFor(() => expect(getPlanningAgenda).toHaveBeenCalledTimes(1))
    await user.click(label)
    expect(await screen.findByRole("switch", { name: "Planejável" })).toBeChecked()
    expect(getAssetProfile).toHaveBeenCalledWith("a1")

    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(putAssetProfile).toHaveBeenCalledTimes(1))
    // The agenda is fetched again so the closed hours are shaded from the new profile.
    await waitFor(() => expect(getPlanningAgenda).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole("switch", { name: "Planejável" })).not.toBeInTheDocument())
  })
})
