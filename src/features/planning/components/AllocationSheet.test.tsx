import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { renderWithQuery } from "@/test/renderWithQuery"
import type { PlanningAllocation } from "../schemas/planningSchemas"
import { PlanningApiError, runAllocationUsage } from "../services/planningService"
import { AllocationSheet } from "./AllocationSheet"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("../services/planningService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/planningService")>()),
  runAllocationUsage: vi.fn(),
}))

const ZONE = "America/Sao_Paulo"
const base: PlanningAllocation = {
  id: "x1", assetId: "a1", assetName: "Impressora 3D", unitId: "u1", kind: "Use", title: "Peça A", notes: "", quantity: 1,
  plannedWorkStart: "2026-11-18T12:00:00.000Z", plannedWorkEnd: "2026-11-18T13:00:00.000Z", occupiedStart: "2026-11-18T12:00:00.000Z", occupiedEnd: "2026-11-18T13:00:00.000Z",
  timeZoneId: ZONE, status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: "tech-1", cancelReason: "",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "AAAA",
}

const technician = ["resource-planning.agenda.read", "resource-planning.allocations.execute"]
const admin = ["resource-planning.agenda.read", "resource-planning.allocations.manage", "resource-planning.allocations.execute", "resource-planning.availability.write"]

function access(granted: string[], userId = "tech-1") {
  vi.mocked(usePermissions).mockReturnValue({
    activeModules: ["resource-planning"], permissions: granted, can: (key) => granted.includes(key), isLoading: false,
    currentUser: { id: userId, tenantId: "t1" } as never, error: null, refresh: vi.fn(),
  })
}

function setup(allocation: PlanningAllocation) {
  const handlers = { onOpenChange: vi.fn(), onEdit: vi.fn(), onChanged: vi.fn() }
  renderWithQuery(<TenantTimeZoneContext.Provider value={ZONE}><AllocationSheet allocation={allocation} {...handlers} /></TenantTimeZoneContext.Provider>)
  return handlers
}

const button = (name: RegExp) => screen.queryByRole("button", { name })

beforeEach(() => {
  vi.clearAllMocks()
  access(technician)
})

describe("AllocationSheet actions", () => {
  it("shows a technician start and cancel on their own scheduled allocation, and no edit", () => {
    setup(base)
    expect(button(/Iniciar uso/)).toBeInTheDocument()
    expect(button(/Cancelar alocação/)).toBeInTheDocument()
    expect(button(/Editar/)).not.toBeInTheDocument()
  })

  it("hides cancel from a technician on someone else's allocation", () => {
    setup({ ...base, createdByUserId: "other-user" })
    expect(button(/Iniciar uso/)).toBeInTheDocument()
    expect(button(/Cancelar alocação/)).not.toBeInTheDocument()
  })

  it("offers finish, and not start or cancel, while running", () => {
    setup({ ...base, status: "Running" })
    expect(button(/Concluir trabalho/)).toBeInTheDocument()
    expect(button(/Iniciar uso/)).not.toBeInTheDocument()
    expect(button(/Cancelar alocação/)).not.toBeInTheDocument()
  })

  it("offers release while cleaning", () => {
    setup({ ...base, status: "Cleaning" })
    expect(button(/Liberar recurso/)).toBeInTheDocument()
    expect(button(/Concluir trabalho/)).not.toBeInTheDocument()
  })

  it("gives an admin edit, start and cancel on anyone's allocation", () => {
    access(admin, "admin-1")
    setup({ ...base, createdByUserId: "other-user" })
    expect(button(/Editar/)).toBeInTheDocument()
    expect(button(/Iniciar uso/)).toBeInTheDocument()
    expect(button(/Cancelar alocação/)).toBeInTheDocument()
  })

  it("keeps a technician away from an Unavailable block, except cancelling their own", () => {
    setup({ ...base, kind: "Unavailable" })
    expect(button(/Iniciar uso/)).not.toBeInTheDocument()
    expect(button(/Editar/)).not.toBeInTheDocument()
    expect(button(/Cancelar alocação/)).toBeInTheDocument()
  })

  it("shows no actions to a reader or on a finished allocation", () => {
    access(["resource-planning.agenda.read"])
    setup(base)
    expect(screen.queryAllByRole("button").filter((b) => /Iniciar|Cancelar alocação|Editar|Concluir|Liberar/.test(b.textContent ?? ""))).toHaveLength(0)
  })

  it("shows no actions on a released allocation even for an admin", () => {
    access(admin, "admin-1")
    setup({ ...base, status: "Released" })
    expect(button(/Iniciar uso|Editar|Cancelar alocação|Concluir|Liberar recurso/)).not.toBeInTheDocument()
  })

  it("points an order-owned allocation to its order instead of showing actions", () => {
    access(admin, "admin-1")
    setup({ ...base, source: "CatalogOrder", referenceLabel: "Pedido 123" })
    expect(screen.getByTestId("planning-order-workflow")).toHaveTextContent("Pedido 123")
    expect(button(/Iniciar uso|Editar|Cancelar alocação/)).not.toBeInTheDocument()
  })

  it("flags an overdue allocation with a plain explanation", () => {
    setup({ ...base, status: "Running", isOverdue: true })
    expect(screen.getByText("Atrasada")).toBeInTheDocument()
    expect(screen.getByText(/o recurso continua em uso/)).toBeInTheDocument()
  })

  it("explains an expired allocation", () => {
    setup({ ...base, isExpired: true })
    expect(screen.getByText("Expirada")).toBeInTheDocument()
    expect(button(/Iniciar uso/)).not.toBeInTheDocument()
  })
})

describe("AllocationSheet usage calls", () => {
  it("sends the action with the row version and reports the result", async () => {
    vi.mocked(runAllocationUsage).mockResolvedValue({ ...base, status: "Running", version: "BBBB" })
    const { onChanged } = setup(base)
    await userEvent.click(screen.getByRole("button", { name: /Iniciar uso/ }))
    await waitFor(() => expect(runAllocationUsage).toHaveBeenCalledWith("x1", { action: "start", expectedVersion: "AAAA", reason: null }))
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: "Running", version: "BBBB" }))
  })

  it("asks for an optional reason before cancelling, then closes", async () => {
    vi.mocked(runAllocationUsage).mockResolvedValue({ ...base, status: "Cancelled" })
    const { onOpenChange } = setup(base)
    await userEvent.click(screen.getByRole("button", { name: /Cancelar alocação/ }))
    await userEvent.type(screen.getByLabelText(/Motivo do cancelamento/), "Peça mudou")
    await userEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/ }))
    await waitFor(() => expect(runAllocationUsage).toHaveBeenCalledWith("x1", { action: "cancel", expectedVersion: "AAAA", reason: "Peça mudou" }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("shows the cancel_forbidden 403 in plain words", async () => {
    vi.mocked(runAllocationUsage).mockRejectedValue(new PlanningApiError(403, "planning.cancel_forbidden", "x"))
    setup(base)
    await userEvent.click(screen.getByRole("button", { name: /Cancelar alocação/ }))
    await userEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Só quem criou a alocação ou um administrador pode cancelá-la.")
  })

  it("lists the conflicts when starting is refused", async () => {
    const conflicts = [{ source: "reservation", allocationId: null, start: "2026-11-18T12:00:00.000Z", end: "2026-11-18T13:00:00.000Z", label: "" }]
    vi.mocked(runAllocationUsage).mockRejectedValue(new PlanningApiError(409, "planning.conflict", "x", conflicts))
    setup(base)
    await userEvent.click(screen.getByRole("button", { name: /Iniciar uso/ }))
    const list = await screen.findByTestId("planning-conflicts")
    expect(list).toHaveTextContent("Ocupado")
    expect(list).toHaveTextContent("reserva")
  })

  it("shows an invalid transition and a version conflict as readable text", async () => {
    vi.mocked(runAllocationUsage).mockRejectedValueOnce(new PlanningApiError(409, "planning.invalid_transition", "x"))
    setup(base)
    await userEvent.click(screen.getByRole("button", { name: /Iniciar uso/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Essa ação não é possível no estado atual da alocação.")
  })
})
