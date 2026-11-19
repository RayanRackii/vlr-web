import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { renderWithQuery } from "@/test/renderWithQuery"
import type { PlanningAllocation } from "../schemas/planningSchemas"
import { PlanningApiError, createAllocation, listPlanningAssets, previewAllocation, updateAllocation } from "../services/planningService"
import { AllocationDialog, type AllocationDialogTarget } from "./AllocationDialog"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("../services/planningService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/planningService")>()),
  listPlanningAssets: vi.fn(),
  previewAllocation: vi.fn(),
  createAllocation: vi.fn(),
  updateAllocation: vi.fn(),
}))

const ZONE = "America/Sao_Paulo"
const asset = { id: "a1", name: "Impressora 3D", tag: "IMP-1", categoryName: "", unitId: "u1", unitName: "Sede", status: "Active", isPlannable: true, isRentalBacked: false, hoursPolicy: "Anytime", workingWindowCount: 0 }
const conflict = { source: "allocation", allocationId: "other", start: "2026-11-18T12:00:00.000Z", end: "2026-11-18T14:00:00.000Z", label: "Peça B" }
const feasible = { feasible: true, occupiedStart: null, occupiedEnd: null, conflicts: [], hoursViolation: null }

const saved: PlanningAllocation = {
  id: "x1", assetId: "a1", assetName: "Impressora 3D", unitId: "u1", kind: "Use", title: "Peça A", notes: "", quantity: 1,
  plannedWorkStart: "2026-11-18T12:00:00.000Z", plannedWorkEnd: "2026-11-18T13:00:00.000Z", occupiedStart: "2026-11-18T12:00:00.000Z", occupiedEnd: "2026-11-18T13:00:00.000Z",
  timeZoneId: ZONE, status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: "u-1", cancelReason: "",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "AAAA",
}

function access(granted: string[]) {
  vi.mocked(usePermissions).mockReturnValue({
    activeModules: ["resource-planning"], permissions: granted, can: (key) => granted.includes(key), isLoading: false,
    currentUser: { id: "u-1", tenantId: "t1" } as never, error: null, refresh: vi.fn(),
  })
}

function setup(target: AllocationDialogTarget = { mode: "create", prefill: { assetId: "a1", date: "2026-11-18", startTime: "09:00" } }) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  renderWithQuery(
    <TenantTimeZoneContext.Provider value={ZONE}><AllocationDialog target={target} onOpenChange={onOpenChange} onSaved={onSaved} /></TenantTimeZoneContext.Provider>,
  )
  return { onOpenChange, onSaved }
}

const saveButton = () => screen.getByRole("button", { name: /Criar alocação|Salvar alterações/ })

beforeEach(() => {
  vi.clearAllMocks()
  access(["resource-planning.agenda.read", "resource-planning.allocations.execute"])
  vi.mocked(listPlanningAssets).mockResolvedValue([asset])
  vi.mocked(previewAllocation).mockResolvedValue(feasible)
})

describe("AllocationDialog", () => {
  it("prefills the clicked cell and previews the window in the tenant zone", async () => {
    setup()
    expect(await screen.findByLabelText("Hora de início")).toHaveValue("09:00")
    expect(screen.getByLabelText("Hora de término")).toHaveValue("10:00")
    await waitFor(() => expect(previewAllocation).toHaveBeenCalledWith(expect.objectContaining({ assetId: "a1", kind: "Use", workStart: "2026-11-18T12:00:00.000Z", workEnd: "2026-11-18T13:00:00.000Z" })))
    expect(await screen.findByText("Horário livre. Pode salvar.")).toBeInTheDocument()
  })

  it("lists the conflicts inline and disables saving", async () => {
    vi.mocked(previewAllocation).mockResolvedValue({ ...feasible, feasible: false, conflicts: [conflict] })
    setup()
    await userEvent.type(await screen.findByLabelText("Título"), "Peça A")
    const list = await screen.findByTestId("planning-conflicts")
    expect(list).toHaveTextContent("Conflito com 1 ocupação")
    expect(list).toHaveTextContent("Peça B")
    expect(list).toHaveTextContent("alocação")
    expect(list).toHaveTextContent("09:00 – 11:00")
    expect(saveButton()).toBeDisabled()
  })

  it("explains a working-hours violation and disables saving", async () => {
    vi.mocked(previewAllocation).mockResolvedValue({ ...feasible, feasible: false, hoursViolation: "start_outside_working_hours" })
    setup()
    await userEvent.type(await screen.findByLabelText("Título"), "Peça A")
    expect(await screen.findByTestId("planning-hours-violation")).toHaveTextContent("O início precisa cair dentro do horário de funcionamento do recurso.")
    expect(saveButton()).toBeDisabled()
  })

  it("creates the allocation when the slot is free", async () => {
    vi.mocked(createAllocation).mockResolvedValue(saved)
    const { onOpenChange, onSaved } = setup()
    await userEvent.type(await screen.findByLabelText("Título"), "Peça A")
    await screen.findByText("Horário livre. Pode salvar.")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await userEvent.click(saveButton())
    await waitFor(() => expect(createAllocation).toHaveBeenCalledWith({
      assetId: "a1", kind: "Use", title: "Peça A", notes: null, workStart: "2026-11-18T12:00:00.000Z", workEnd: "2026-11-18T13:00:00.000Z", prepMinutes: null, cleanupMinutes: null,
    }))
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows the conflicts of a 409 returned by the save itself", async () => {
    vi.mocked(createAllocation).mockRejectedValue(new PlanningApiError(409, "planning.conflict", "x", [conflict]))
    const { onOpenChange } = setup()
    await userEvent.type(await screen.findByLabelText("Título"), "Peça A")
    await screen.findByText("Horário livre. Pode salvar.")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await userEvent.click(saveButton())
    expect(await screen.findByTestId("planning-conflicts")).toHaveTextContent("Peça B")
    expect(screen.getByRole("alert")).toHaveTextContent("O recurso já está ocupado nesse período.")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("shows the hours reason of a 422 from the save", async () => {
    vi.mocked(createAllocation).mockRejectedValue(new PlanningApiError(422, "planning.outside_working_hours", "x", [], "outside_working_hours"))
    setup()
    await userEvent.type(await screen.findByLabelText("Título"), "Peça A")
    await screen.findByText("Horário livre. Pode salvar.")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await userEvent.click(saveButton())
    expect(await screen.findByTestId("planning-hours-violation")).toHaveTextContent("O período inteiro precisa caber")
  })

  it("asks for a title before saving", async () => {
    setup()
    await screen.findByText("Horário livre. Pode salvar.")
    expect(saveButton()).toBeDisabled()
  })

  it("hides the Unavailable kind from a technician", async () => {
    setup()
    await screen.findByLabelText("Título")
    expect(screen.queryByRole("radio", { name: "Indisponível" })).not.toBeInTheDocument()
  })

  it("offers the Unavailable kind to an admin and relabels the title as reason", async () => {
    access(["resource-planning.agenda.read", "resource-planning.allocations.manage"])
    setup()
    await userEvent.click(await screen.findByRole("radio", { name: "Indisponível" }))
    expect(screen.getByLabelText("Motivo")).toBeInTheDocument()
    expect(screen.queryByLabelText("Preparo (min)")).not.toBeInTheDocument()
    await waitFor(() => expect(previewAllocation).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "Unavailable" })))
  })

  it("edits with the version, ignoring the allocation's own conflict in the preview", async () => {
    access(["resource-planning.agenda.read", "resource-planning.allocations.manage"])
    vi.mocked(previewAllocation).mockResolvedValue({ ...feasible, feasible: false, conflicts: [{ ...conflict, allocationId: "x1", label: "Peça A" }] })
    vi.mocked(updateAllocation).mockResolvedValue({ ...saved, title: "Peça A2" })
    setup({ mode: "edit", allocation: saved })
    const title = await screen.findByLabelText("Título")
    expect(title).toHaveValue("Peça A")
    await userEvent.type(title, "2")
    await screen.findByText("Horário livre. Pode salvar.")
    expect(screen.queryByTestId("planning-conflicts")).not.toBeInTheDocument()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await userEvent.click(saveButton())
    await waitFor(() => expect(updateAllocation).toHaveBeenCalledWith("x1", expect.objectContaining({ expectedVersion: "AAAA", title: "Peça A2" })))
  })

  it("tells the user to reload on a version conflict", async () => {
    access(["resource-planning.agenda.read", "resource-planning.allocations.manage"])
    vi.mocked(updateAllocation).mockRejectedValue(new PlanningApiError(409, "planning.version_conflict", "x"))
    setup({ mode: "edit", allocation: saved })
    await userEvent.type(await screen.findByLabelText("Título"), "2")
    await screen.findByText("Horário livre. Pode salvar.")
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await userEvent.click(saveButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("A alocação mudou desde que você a abriu")
  })
})
