import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { renderWithQuery } from "@/test/renderWithQuery"
import { BlockPeriodDialog } from "./BlockPeriodDialog"
import { blockPeriod } from "./blockPeriod"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()),
  listOccupancyKinds: vi.fn(),
}))
vi.mock("./blockPeriod", async (importOriginal) => ({ ...(await importOriginal<typeof import("./blockPeriod")>()), blockPeriod: vi.fn() }))

const kind = (id: string, label: string, patch = {}) => ({ id, key: id, label, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 0, isActive: true, ...patch })
const resources = [{ id: "r1", name: "Quadra 1" }, { id: "r2", name: "Quadra 2" }]

function access(granted: string[]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: ["rentals"], permissions: granted, can: (key) => granted.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function setup(prefill = { resourceId: "r1", date: "2026-11-10", start: "14:00", end: "18:00" }) {
  const onOpenChange = vi.fn()
  const onBlocked = vi.fn()
  renderWithQuery(<BlockPeriodDialog open onOpenChange={onOpenChange} resources={resources} prefill={prefill} tenantId="t1" onBlocked={onBlocked} />)
  return { onOpenChange, onBlocked }
}

beforeEach(() => {
  vi.clearAllMocks()
  access(["rentals.schedule.write"])
  vi.mocked(listOccupancyKinds).mockResolvedValue([kind("k-closed", "Fechado"), kind("k-open", "Aberto", { isBookableByCustomer: true, blocksCapacity: false }), kind("k-lesson", "Aula", { isBookableByCustomer: true })])
  vi.mocked(blockPeriod).mockResolvedValue({ blocked: 2, skipped: [], failed: [] })
})

describe("BlockPeriodDialog", () => {
  it("prefills resource, date and times", async () => {
    setup()
    expect(await screen.findByLabelText("Data")).toHaveValue("2026-11-10")
    expect(screen.getByLabelText("Início")).toHaveValue("14:00")
    expect(screen.getByLabelText("Fim")).toHaveValue("18:00")
    expect(screen.getByRole("combobox", { name: "Recurso" })).toHaveTextContent("Quadra 1")
  })

  it("lists only blocking, non customer-bookable kinds as Motivo", async () => {
    setup()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveTextContent("Fechado"))
    await userEvent.click(screen.getByRole("combobox", { name: "Motivo" }))
    expect(await screen.findAllByRole("option")).toHaveLength(1)
    expect(screen.queryByRole("option", { name: "Aberto" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Aula" })).not.toBeInTheDocument()
  })

  it("submits the range, kind and note, then refetches and closes", async () => {
    const { onOpenChange, onBlocked } = setup()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveTextContent("Fechado"))
    await userEvent.type(screen.getByLabelText("Observação"), "Torneio")
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    await waitFor(() => expect(blockPeriod).toHaveBeenCalledWith({ rentalAssetId: "r1", date: "2026-11-10", start: "14:00", end: "18:00", kindId: "k-closed", note: "Torneio" }))
    await waitFor(() => expect(onBlocked).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("lists booked slots that were not blocked and stays open", async () => {
    vi.mocked(blockPeriod).mockResolvedValue({ blocked: 3, skipped: ["15:00–16:00"], failed: [] })
    const { onOpenChange } = setup()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveTextContent("Fechado"))
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    expect(await screen.findByText("3 horários bloqueados.")).toBeInTheDocument()
    expect(screen.getByText("1 já reservado não foi bloqueado: 15:00–16:00.")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("hides the zero count when everything in range was already booked", async () => {
    vi.mocked(blockPeriod).mockResolvedValue({ blocked: 0, skipped: ["15:00–16:00"], failed: [] })
    setup()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveTextContent("Fechado"))
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    expect(await screen.findByText("1 já reservado não foi bloqueado: 15:00–16:00.")).toBeInTheDocument()
    expect(screen.queryByText(/0 horários/)).not.toBeInTheDocument()
  })

  it("accepts an end at midnight", async () => {
    setup({ resourceId: "r1", date: "2026-11-10", start: "22:00", end: "00:00" })
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveTextContent("Fechado"))
    expect(screen.getByRole("button", { name: "Bloquear" })).toBeEnabled()
  })

  it("renders nothing without rentals.schedule.write", () => {
    access(["rentals.schedule.read"])
    setup()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
