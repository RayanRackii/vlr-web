import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { renderWithQuery } from "@/test/renderWithQuery"
import { tenantKey } from "@/lib/queryKeys"
import type { AssetProfile } from "../schemas/planningSchemas"
import { PlanningApiError, getAssetProfile, putAssetProfile } from "../services/planningService"
import { AssetAvailabilityDialog } from "./AssetAvailabilityDialog"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("../services/planningService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/planningService")>()),
  getAssetProfile: vi.fn(),
  putAssetProfile: vi.fn(),
}))

const profile = (over: Partial<AssetProfile> = {}): AssetProfile => ({
  assetId: "a1", isConfigured: true, isPlannable: true, isRentalBacked: false, capacity: 1, hoursPolicy: "StartWithinHours",
  defaultPrepMinutes: 0, defaultCleanupMinutes: 0, workingHours: [{ dayOfWeek: 1, openTime: "08:00:00", closeTime: "18:00:00" }], ...over,
})

function setup(loaded: AssetProfile = profile()) {
  vi.mocked(getAssetProfile).mockResolvedValue(loaded)
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  const view = renderWithQuery(<AssetAvailabilityDialog assetId="a1" assetName="Impressora 3D" onOpenChange={onOpenChange} onSaved={onSaved} />)
  return { ...view, onOpenChange, onSaved }
}

const save = () => screen.getByRole("button", { name: "Salvar" })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usePermissions).mockReturnValue({
    activeModules: ["resource-planning"], permissions: ["resource-planning.availability.write"], can: () => true, isLoading: false,
    currentUser: { id: "u-1", tenantId: "t1" } as never, error: null, refresh: vi.fn(),
  })
  vi.mocked(putAssetProfile).mockResolvedValue(profile())
})

describe("AssetAvailabilityDialog", () => {
  it("loads the profile, explains each policy and shows the weekly hours", async () => {
    setup()
    expect(await screen.findByRole("switch", { name: "Planejável" })).toBeChecked()
    expect(screen.getByText("Livre 24 horas")).toBeInTheDocument()
    expect(screen.getByText(/só pode começar dentro do horário/)).toBeInTheDocument()
    expect(screen.getByText(/precisa caber no horário de funcionamento/)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Começar no horário/ })).toBeChecked()
    const monday = screen.getByTestId("availability-day-1")
    expect(within(monday).getByLabelText("Segunda-feira: abre às")).toHaveValue("08:00")
    expect(within(screen.getByTestId("availability-day-0")).getByText("Fechado")).toBeInTheDocument()
    expect(screen.getByLabelText("Capacidade")).toBeDisabled()
  })

  it("saves the edited profile in the API shape and refreshes the agenda and resource list", async () => {
    const user = userEvent.setup()
    const { client, onSaved, onOpenChange } = setup()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    await screen.findByRole("switch", { name: "Planejável" })
    await user.clear(screen.getByLabelText("Preparo padrão (min)"))
    await user.type(screen.getByLabelText("Preparo padrão (min)"), "15")
    await user.click(screen.getByRole("button", { name: "Copiar o horário de Segunda-feira para segunda a sexta" }))
    await user.click(save())
    await waitFor(() => expect(putAssetProfile).toHaveBeenCalledTimes(1))
    const [id, body] = vi.mocked(putAssetProfile).mock.calls[0]
    expect(id).toBe("a1")
    expect(body).toEqual({
      isPlannable: true, capacity: 1, hoursPolicy: "StartWithinHours", defaultPrepMinutes: 15, defaultCleanupMinutes: 0,
      workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, openTime: "08:00", closeTime: "18:00" })),
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onSaved).toHaveBeenCalled()
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toContainEqual(tenantKey("staff", "t1", "planning-agenda"))
    expect(keys).toContainEqual(tenantKey("staff", "t1", "planning-assets"))
  })

  it("blocks save with an inline message when a window closes before it opens or overlaps another", async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole("switch", { name: "Planejável" })
    const monday = within(screen.getByTestId("availability-day-1"))
    await user.clear(monday.getByLabelText("Segunda-feira: fecha às"))
    await user.type(monday.getByLabelText("Segunda-feira: fecha às"), "07:00")
    expect(await monday.findByText("O fim precisa ser depois do início.")).toBeInTheDocument()
    await user.click(save())
    expect(putAssetProfile).not.toHaveBeenCalled()

    await user.clear(monday.getByLabelText("Segunda-feira: fecha às"))
    await user.type(monday.getByLabelText("Segunda-feira: fecha às"), "12:00")
    await user.click(monday.getByRole("button", { name: "Adicionar janela em Segunda-feira" }))
    await user.clear(monday.getByLabelText("Segunda-feira 2: abre às"))
    await user.type(monday.getByLabelText("Segunda-feira 2: abre às"), "11:00")
    expect(await monday.findAllByText("Esta janela se sobrepõe a outra do mesmo dia.")).toHaveLength(2)
    expect(putAssetProfile).not.toHaveBeenCalled()
  })

  it("asks for hours when a plannable asset has none", async () => {
    const user = userEvent.setup()
    setup(profile({ workingHours: [] }))
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(save())
    expect(await screen.findByText(/Cadastre ao menos uma janela/)).toBeInTheDocument()
    expect(putAssetProfile).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: /Livre 24 horas/ }))
    await user.click(save())
    await waitFor(() => expect(putAssetProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(putAssetProfile).mock.calls[0][1]).toMatchObject({ hoursPolicy: "Anytime", workingHours: [] })
  })

  it("keeps the stored windows when switching to Anytime and back", async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(screen.getByRole("radio", { name: /Livre 24 horas/ }))
    expect(screen.queryByTestId("availability-day-1")).not.toBeInTheDocument()
    expect(screen.getByText(/ficam guardados/)).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /Tudo dentro do horário/ }))
    expect(within(screen.getByTestId("availability-day-1")).getByLabelText("Segunda-feira: abre às")).toHaveValue("08:00")
    await user.click(screen.getByRole("radio", { name: /Livre 24 horas/ }))
    await user.click(save())
    await waitFor(() => expect(putAssetProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(putAssetProfile).mock.calls[0][1]).toMatchObject({
      hoursPolicy: "Anytime", workingHours: [{ dayOfWeek: 1, openTime: "08:00", closeTime: "18:00" }],
    })
  })

  it("keeps the stored windows when plannable is switched off", async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole("switch", { name: "Planejável" }))
    await user.click(save())
    await waitFor(() => expect(putAssetProfile).toHaveBeenCalledTimes(1))
    expect(vi.mocked(putAssetProfile).mock.calls[0][1]).toMatchObject({
      isPlannable: false, workingHours: [{ dayOfWeek: 1, openTime: "08:00", closeTime: "18:00" }],
    })
  })

  it("shows a broken stored window instead of dropping it, even under Anytime", async () => {
    const user = userEvent.setup()
    setup(profile({ hoursPolicy: "Anytime", workingHours: [{ dayOfWeek: 1, openTime: "18:00", closeTime: "08:00" }] }))
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(save())
    expect(await screen.findByText("O fim precisa ser depois do início.")).toBeInTheDocument()
    expect(putAssetProfile).not.toHaveBeenCalled()
  })

  it("hides the policy and hours while the asset is not plannable", async () => {
    const user = userEvent.setup()
    setup(profile({ isPlannable: false, isConfigured: false, hoursPolicy: "", workingHours: [] }))
    const toggle = await screen.findByRole("switch", { name: "Planejável" })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByText("Regra de horário")).not.toBeInTheDocument()
    await user.click(toggle)
    // default policy for an opt-in asset
    expect(screen.getByRole("radio", { name: /Começar no horário/ })).toBeChecked()
  })

  it("shows the explanation, not the editor, for a rental-backed asset", async () => {
    setup(profile({ isRentalBacked: true }))
    expect(await screen.findByTestId("availability-rental-notice")).toHaveTextContent("Este recurso é alugável")
    expect(screen.queryByTestId("availability-day-1")).not.toBeInTheDocument()
    expect(putAssetProfile).not.toHaveBeenCalled()
  })

  it("switches to the rental explanation when the API answers 409 rental_schedule_authority", async () => {
    const user = userEvent.setup()
    vi.mocked(putAssetProfile).mockRejectedValue(new PlanningApiError(409, "planning.rental_schedule_authority", "rental"))
    setup()
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(save())
    expect(await screen.findByTestId("availability-rental-notice")).toBeInTheDocument()
  })

  it("shows the 422 working_hours_required message and keeps the form open", async () => {
    const user = userEvent.setup()
    vi.mocked(putAssetProfile).mockRejectedValue(new PlanningApiError(422, "planning.working_hours_required", "hours"))
    const { onOpenChange } = setup()
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(save())
    expect(await screen.findByRole("alert")).toHaveTextContent("Defina o horário de funcionamento do recurso.")
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("availability-day-1")).toBeInTheDocument()
  })

  it("shows a generic message for a 400 and the version-conflict message for a 409", async () => {
    const user = userEvent.setup()
    vi.mocked(putAssetProfile).mockRejectedValueOnce(new PlanningApiError(400, "http_400", "bad"))
    setup()
    await screen.findByRole("switch", { name: "Planejável" })
    await user.click(save())
    expect(await screen.findByRole("alert")).toHaveTextContent("Alguns dados enviados não são válidos. Confira os campos.")

    vi.mocked(putAssetProfile).mockRejectedValueOnce(new PlanningApiError(409, "planning.version_conflict", "version"))
    await user.click(save())
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/alterada por outra pessoa/))
  })

  it("explains a failed load and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(getAssetProfile).mockRejectedValueOnce(new PlanningApiError(0, "network", "offline"))
    renderWithQuery(<AssetAvailabilityDialog assetId="a1" assetName="Impressora 3D" onOpenChange={vi.fn()} />)
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sem conexão/)
    vi.mocked(getAssetProfile).mockResolvedValue(profile())
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(await screen.findByRole("switch", { name: "Planejável" })).toBeInTheDocument()
  })
})
