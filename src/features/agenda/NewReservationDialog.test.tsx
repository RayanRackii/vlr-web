import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { createStaffReservation, StaffReservationError } from "@/features/rentals/services/reservationsService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import { listTenantCustomers } from "@/features/users/services/usersService"
import { renderWithQuery } from "@/test/renderWithQuery"
import { asset } from "./agendaFixtures"
import { NewReservationDialog } from "./NewReservationDialog"
import { defaultEnd } from "./newReservation"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()),
  listAdminRentalAssets: vi.fn(),
}))
vi.mock("@/features/rentals/services/reservationsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rentals/services/reservationsService")>()),
  createStaffReservation: vi.fn(),
}))
vi.mock("@/features/users/services/usersService", () => ({ listTenantCustomers: vi.fn() }))

const customerId = "44444444-4444-4444-8444-444444444444"
const court = { ...asset, name: "Quadra 1", requiresDeposit: true }
const camera = { ...asset, id: "11111111-1111-4111-8111-1111111111c1", assetId: "11111111-1111-4111-8111-1111111111c2", name: "Câmera", requiresDeposit: false }

function access(granted: string[]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: ["rentals"], permissions: granted, can: (key) => granted.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function setup(prefill: { resourceId?: string; date: string; start?: string; end?: string } = { resourceId: court.id, date: "2026-11-10", start: "14:00" }) {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  renderWithQuery(<NewReservationDialog open onOpenChange={onOpenChange} prefill={prefill} tenantId="t1" onCreated={onCreated} />)
  return { onOpenChange, onCreated }
}
async function resourceReady(name = "Quadra 1") {
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Recurso" })).toHaveTextContent(name))
}
async function pickCustomer() {
  await userEvent.type(screen.getByLabelText("Buscar cliente por nome ou e-mail"), "Ana")
  await userEvent.click(await screen.findByRole("button", { name: /Ana Souza/ }))
}
async function fillNewCustomer() {
  await userEvent.click(screen.getByRole("button", { name: "+ Novo cliente" }))
  await userEvent.type(screen.getByLabelText("Nome"), "Bia Lima")
  await userEvent.type(screen.getByLabelText("WhatsApp"), "11999998888")
}

beforeEach(() => {
  vi.clearAllMocks()
  access(["rentals.reservations.create"])
  vi.mocked(listAdminRentalAssets).mockResolvedValue([court, camera])
  vi.mocked(listTenantCustomers).mockResolvedValue({ items: [{ id: customerId, name: "Ana Souza", email: "ana@x.com", emailVerified: true, createdAt: "2026-01-01T00:00:00Z" }], page: 1, pageSize: 8, total: 1 })
  vi.mocked(createStaffReservation).mockResolvedValue({} as never)
})

describe("NewReservationDialog", () => {
  it("prefills resource, date, start and an end one hour later", async () => {
    setup()
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-10")
    expect(screen.getByLabelText("Início")).toHaveValue("14:00")
    expect(screen.getByLabelText("Fim")).toHaveValue("15:00")
    await resourceReady()
  })

  it("uses the first allowed duration of the resource as the default length", () => {
    expect(defaultEnd("14:00", "90,120")).toBe("15:30")
    expect(defaultEnd("14:00", null)).toBe("15:00")
    expect(defaultEnd("23:30", "120")).toBe("23:59")
  })

  it("submits an existing customer with the asset id of the resource", async () => {
    const { onOpenChange, onCreated } = setup()
    await resourceReady()
    await pickCustomer()
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    await waitFor(() => expect(createStaffReservation).toHaveBeenCalledWith({ customerId, date: "2026-11-10", startTime: "14:00", endTime: "15:00", items: [{ assetId: court.assetId, quantity: 1 }], awaitingDeposit: false }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onCreated).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith("Reserva criada")
  })

  it("sends a new customer instead of a customer id, and the deposit flag when ticked", async () => {
    setup()
    await resourceReady()
    await fillNewCustomer()
    await userEvent.type(screen.getByLabelText("E-mail (opcional)"), "bia@x.com")
    await userEvent.click(await screen.findByLabelText("Aguardando sinal"))
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    await waitFor(() => expect(createStaffReservation).toHaveBeenCalledWith({ newCustomer: { name: "Bia Lima", whatsApp: "11999998888", email: "bia@x.com" }, date: "2026-11-10", startTime: "14:00", endTime: "15:00", items: [{ assetId: court.assetId, quantity: 1 }], awaitingDeposit: true }))
  })

  it("omits an empty e-mail from the new customer", async () => {
    setup()
    await resourceReady()
    await fillNewCustomer()
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    await waitFor(() => expect(createStaffReservation).toHaveBeenCalled())
    expect(vi.mocked(createStaffReservation).mock.calls[0]?.[0].newCustomer).toEqual({ name: "Bia Lima", whatsApp: "11999998888" })
  })

  it("selects the existing customer on 409 CUSTOMER_EXISTS and lets the user submit again", async () => {
    vi.mocked(createStaffReservation).mockRejectedValueOnce(new StaffReservationError("exists", "CUSTOMER_EXISTS", 409, customerId))
    const { onOpenChange } = setup()
    await resourceReady()
    await fillNewCustomer()
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    expect(await screen.findByTestId("selected-customer")).toHaveTextContent("Bia Lima")
    expect(toast.info).toHaveBeenCalledWith("Cliente já cadastrado — selecionado")
    expect(onOpenChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    await waitFor(() => expect(createStaffReservation).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStaffReservation).mock.calls[1]?.[0]).toMatchObject({ customerId })
    expect(vi.mocked(createStaffReservation).mock.calls[1]?.[0]).not.toHaveProperty("newCustomer")
  })

  it("shows the API message and stays open on another error", async () => {
    vi.mocked(createStaffReservation).mockRejectedValueOnce(new StaffReservationError("Horário já reservado.", null, 409, null))
    const { onOpenChange } = setup()
    await resourceReady()
    await pickCustomer()
    await userEvent.click(screen.getByRole("button", { name: "Criar reserva" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Horário já reservado.")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does not offer Aguardando sinal for a resource without a deposit", async () => {
    setup({ resourceId: camera.id, date: "2026-11-10", start: "14:00" })
    await resourceReady("Câmera")
    expect(screen.queryByLabelText("Aguardando sinal")).not.toBeInTheDocument()
  })

  it("offers Aguardando sinal for a resource that requires a deposit", async () => {
    setup()
    expect(await screen.findByLabelText("Aguardando sinal")).not.toBeChecked()
  })

  it("renders nothing without rentals.reservations.create", () => {
    access(["rentals.reservations.read"])
    setup()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
