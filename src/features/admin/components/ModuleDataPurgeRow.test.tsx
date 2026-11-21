import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ModuleDataPurgeRow } from "@/features/admin/components/ModuleDataPurgeRow"
import type { ModuleDataPurgePreview } from "@/features/admin/schemas/moduleDataPurgeSchemas"
import {
  cancelModuleDataPurge,
  getModuleDataPurgePreview,
  ModuleDataPurgeError,
  scheduleModuleDataPurge,
} from "@/features/admin/services/moduleDataPurgeService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/moduleDataPurgeService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/services/moduleDataPurgeService")
  >("@/features/admin/services/moduleDataPurgeService")
  return {
    ...actual,
    getModuleDataPurgePreview: vi.fn(),
    scheduleModuleDataPurge: vi.fn(),
    cancelModuleDataPurge: vi.fn(),
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TENANT_ID = "11111111-1111-4111-8111-111111111111"
const previewMock = vi.mocked(getModuleDataPurgePreview)
const scheduleMock = vi.mocked(scheduleModuleDataPurge)
const cancelMock = vi.mocked(cancelModuleDataPurge)

function preview(overrides: Partial<ModuleDataPurgePreview> = {}): ModuleDataPurgePreview {
  return {
    module: "rentals",
    moduleActive: false,
    tables: [
      { table: "rentals.reservations", rows: 7 },
      { table: "rentals.extra_table", rows: 3 },
    ],
    storageObjects: 2,
    blockers: [],
    pending: null,
    ...overrides,
  }
}

async function expand() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { expanded: false }))
  return user
}

describe("ModuleDataPurgeRow", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    previewMock.mockReset()
    scheduleMock.mockReset()
    cancelMock.mockReset()
    previewMock.mockResolvedValue(preview())
  })

  it("does not call the API until the row is expanded", async () => {
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    expect(previewMock).not.toHaveBeenCalled()

    await expand()

    await waitFor(() => {
      expect(previewMock).toHaveBeenCalledWith(TENANT_ID, "rentals")
    })
    expect(await screen.findByText(/Dados guardados: 10 registros/)).toBeInTheDocument()
    expect(screen.getByText(/2 arquivos/)).toBeInTheDocument()
    expect(screen.getByText("rentals.extra_table")).toBeInTheDocument()
    expect(screen.getByText("Reservas")).toBeInTheDocument()
  })

  it("renders nothing for a module that is not purgeable", () => {
    const { container } = render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="billing" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("keeps the confirm button disabled until the typed key matches, then schedules", async () => {
    scheduleMock.mockResolvedValue({ id: "p1", scheduledFor: "2026-12-21T00:00:00Z" })
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    const user = await expand()
    await user.click(await screen.findByRole("button", { name: "Excluir dados…" }))

    expect(
      screen.getByText("Os dados serão excluídos em 30 dias. Até lá você pode cancelar."),
    ).toBeInTheDocument()
    const confirm = screen.getByRole("button", { name: "Agendar exclusão" })
    expect(confirm).toBeDisabled()

    const input = screen.getByLabelText(/Digite rentals/)
    await user.type(input, "rental")
    expect(confirm).toBeDisabled()
    await user.type(input, "s")
    expect(confirm).toBeEnabled()

    previewMock.mockResolvedValue(
      preview({ pending: { id: "p1", scheduledFor: "2026-12-21T12:00:00Z" } }),
    )
    await user.click(confirm)

    await waitFor(() => {
      expect(scheduleMock).toHaveBeenCalledWith(TENANT_ID, "rentals", "rentals")
    })
    expect(await screen.findByText(/Exclusão agendada para 21\/12\/2026/)).toBeInTheDocument()
  })

  it("renders blockers in plain language and disables the delete button", async () => {
    previewMock.mockResolvedValue(
      preview({
        blockers: [
          { code: "fk.restrict", table: "catalog.orders", rows: 4 },
          { code: "allocations.unreleased" },
        ],
      }),
    )
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    await expand()

    expect(
      await screen.findByText(/Pedidos ainda usam recursos deste módulo\. Exclua os dados de Catálogo & Pedidos antes/),
    ).toBeInTheDocument()
    expect(screen.getByText(/alocações de recursos não liberadas/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Excluir dados…" })).toBeDisabled()
  })

  it("shows the pending chip and cancels with the optional reason", async () => {
    previewMock.mockResolvedValue(
      preview({ pending: { id: "p1", scheduledFor: "2026-12-21T12:00:00Z" } }),
    )
    cancelMock.mockResolvedValue(undefined)
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    const user = await expand()

    await user.click(await screen.findByRole("button", { name: "Cancelar exclusão" }))
    await user.type(screen.getByLabelText("Motivo (opcional)"), "engano")
    previewMock.mockResolvedValue(preview())
    const dialogButtons = screen.getAllByRole("button", { name: "Cancelar exclusão" })
    await user.click(dialogButtons[dialogButtons.length - 1])

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith(TENANT_ID, "rentals", "engano")
    })
    expect(await screen.findByRole("button", { name: "Excluir dados…" })).toBeInTheDocument()
  })

  it("maps a scheduling error into the dialog", async () => {
    scheduleMock.mockRejectedValue(
      new ModuleDataPurgeError("Já existe uma exclusão agendada para este módulo.", "purge.already_pending", null),
    )
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    const user = await expand()
    await user.click(await screen.findByRole("button", { name: "Excluir dados…" }))
    await user.type(screen.getByLabelText(/Digite rentals/), "rentals")
    await user.click(screen.getByRole("button", { name: "Agendar exclusão" }))

    expect(
      await screen.findByText("Já existe uma exclusão agendada para este módulo."),
    ).toBeInTheDocument()
  })

  it("shows a load error with retry", async () => {
    previewMock.mockRejectedValueOnce(new Error("boom"))
    render(<ModuleDataPurgeRow tenantId={TENANT_ID} moduleKey="rentals" />)
    const user = await expand()
    expect(await screen.findByText("boom")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findByText(/Dados guardados/)).toBeInTheDocument()
  })
})
