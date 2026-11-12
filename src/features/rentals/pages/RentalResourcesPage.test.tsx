import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider, Routes, Route, Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: false,
    isTrialReadOnly: false,
    trialEndsAt: undefined,
    trialPurgeAt: undefined,
  }),
}))

vi.mock("@/features/admin/hooks/usePlatformAdmin", () => ({
  useIsPlatformAdmin: () => false,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/assets/services/assetsService", () => ({
  getAssets: vi.fn(async () => {
    throw new Error("must not call GET /api/assets")
  }),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  canCreateAssetCategory: () => false,
  getCategories: vi.fn(async () => {
    throw new Error("must not call GET /api/asset-categories")
  }),
}))

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listAssetFamilyCatalog: vi.fn(async () => {
    throw new Error("must not call GET /api/asset-families")
  }),
  listActiveAssetFamilies: vi.fn(async () => {
    throw new Error("must not call GET /api/asset-families")
  }),
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
  createUnit: vi.fn(),
}))

vi.mock("@/features/assets/services/rentalPricingService", () => ({
  getAssetPricings: vi.fn(),
}))

vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn(),
  listScheduleTemplates: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantModuleMenuItems: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/features/rentals/services/setupStatusService", () => ({
  getSetupStatus: vi.fn(async () => ({ checklist: [], resources: [] })),
}))

vi.mock("@/features/rentals/services/rentalResourcesService", () => ({
  listRentalAssetCategories: vi.fn(),
  listRentalAssetFamilies: vi.fn(),
  createRentalAsset: vi.fn(),
  updateRentalAsset: vi.fn(),
}))

import { getUnits } from "@/features/assets/services/unitsService"
import { getAssetPricings } from "@/features/assets/services/rentalPricingService"
import { RentalResourceEditorPage } from "@/features/rentals/pages/RentalResourceEditorPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import {
  createRentalAsset,
  listRentalAssetCategories,
  listRentalAssetFamilies,
  updateRentalAsset,
} from "@/features/rentals/services/rentalResourcesService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"

const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const FAMILY_ID = "11111111-1111-4111-8111-111111111111"
const RENTAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const getUnitsMock = vi.mocked(getUnits)
const listAssetsMock = vi.mocked(listAdminRentalAssets)
const listCategoriesMock = vi.mocked(listRentalAssetCategories)
const listFamiliesMock = vi.mocked(listRentalAssetFamilies)
const createMock = vi.mocked(createRentalAsset)
const updateMock = vi.mocked(updateRentalAsset)
const getAssetPricingsMock = vi.mocked(getAssetPricings)

const WRITE_PERMS = ["rentals.assets.read", "rentals.assets.write", "rentals.pricing.read"] as const

function renderPage(permissions: readonly string[] = WRITE_PERMS, path = "/configuracoes/recursos") {
  const router = createMemoryRouter([{ path: "*", element: <>
    <Link to="/dashboard">Dashboard</Link>
    <TestRoutes />
  </> }], { initialEntries: ["/dashboard", path], initialIndex: 1 })
  function TestRoutes() {
    const navigate = useNavigate()
    return <>
      <button onClick={() => navigate(-1)}>Back</button>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
        <Routes>
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/configuracoes/recursos" element={<RentalResourcesPage />} />
          <Route path="/configuracoes/recursos/cadastro" element={<RentalResourceEditorPage cadastro />} />
          <Route path="/configuracoes/recursos/:id/cadastro" element={<h1>Cadastro salvo</h1>} />
          <Route path="/configuracoes/recursos/novo" element={<RentalResourceEditorPage />} />
          <Route path="/configuracoes/recursos/:id" element={<RentalResourceEditorPage />} />
        </Routes>
      </TestPermissionProvider>
    </>
  }
  return { ...render(<RouterProvider router={router} />), router }
}

async function openPricingTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: i18n.t("rentals.resources.sheetTabs.pricingRules") }),
  )
}

function expectNoForbiddenCopy(container: HTMLElement) {
  const text = container.textContent ?? ""
  expect(text).not.toMatch(/Asset Registry/i)
  expect(text).not.toMatch(/asset-registry/i)
  expect(text).not.toContain("/ativos")
  expect(text).not.toMatch(/\bAtivos\b/)
}

describe("RentalResourcesPage", () => {
  beforeEach(() => {
    getUnitsMock.mockReset()
    listAssetsMock.mockReset()
    listCategoriesMock.mockReset()
    listFamiliesMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    getAssetPricingsMock.mockReset()

    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
    ])
    listCategoriesMock.mockResolvedValue([{ id: CATEGORY_ID, name: "Quadra" }])
    listFamiliesMock.mockResolvedValue([
      {
        id: FAMILY_ID,
        key: "spaces",
        label: "Espaços",
        fields: [],
        sortOrder: 0,
        isActive: true,
      },
    ])
    listAssetsMock.mockResolvedValue([])
    getAssetPricingsMock.mockResolvedValue([])
    createMock.mockResolvedValue({
      id: RENTAL_ID,
      assetId: ASSET_ID,
      name: "Quadra 1",
      isActive: true,
      requiresDeposit: true,
      schedulePolicy: "SlotGrid",
      unitId: UNIT_ID,
      type: "Location",
      totalQuantity: 1,
      queueEnabled: false,
      queueOpeningTime: null,
      categoryId: CATEGORY_ID,
      categoryName: "Quadra",
    })
    updateMock.mockResolvedValue({
      id: RENTAL_ID,
      assetId: ASSET_ID,
      name: "Quadra 1 editada",
      isActive: true,
      requiresDeposit: true,
      schedulePolicy: "SlotGrid",
      unitId: UNIT_ID,
      type: "Location",
      totalQuantity: 1,
      queueEnabled: false,
      queueOpeningTime: null,
      categoryId: CATEGORY_ID,
      categoryName: "Quadra",
    })
  })

  it("opens the new resource cadastro as a full page with a valid create destination", async () => {
    const user = userEvent.setup()
    const { router } = renderPage(WRITE_PERMS, "/configuracoes/recursos/cadastro")
    expect(await screen.findByRole("heading", { level: 1, name: "Novo recurso" })).toBeVisible()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
    await user.type(screen.getByRole("textbox", { name: i18n.t("rentals.resources.form.name") }), "Sala nova")
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    await waitFor(() => expect(router.state.location.pathname).toBe(`/configuracoes/recursos/${RENTAL_ID}/cadastro`), { timeout: 4500 })
    expect(screen.getByRole("heading", { name: "Cadastro salvo" })).toBeVisible()
  })

  it("moves Espaço/Bem with the keyboard and shows API validation on the field and in a summary", async () => {
    const { AxiosError } = await import("axios")
    const error = new AxiosError("Request failed")
    error.response = { status: 400, data: { errors: { Name: ["Informe um nome válido."] } } } as never
    createMock.mockRejectedValue(error)
    const user = userEvent.setup()
    renderPage(WRITE_PERMS, "/configuracoes/recursos/novo")
    const space = await screen.findByRole("radio", { name: i18n.t("rentals.resources.typeLocation") })
    space.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("radio", { name: i18n.t("rentals.resources.typeGood") })).toBeChecked()
    await user.keyboard(" ")
    expect(screen.getByRole("radio", { name: i18n.t("rentals.resources.typeGood") })).toBeChecked()
    await user.type(screen.getByRole("textbox", { name: i18n.t("rentals.resources.form.name") }), "Sala")
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") }))
    const summary = await screen.findByRole("alert")
    expect(summary).toHaveTextContent(i18n.t("rentals.resources.saveErrorSummary"))
    expect(summary).toHaveTextContent("Informe um nome válido.")
    expect(screen.getAllByText("Informe um nome válido.")).toHaveLength(2)
  })

  it("opens the create page directly with the footer save gated by validity", async () => {
    renderPage(WRITE_PERMS, "/configuracoes/recursos/novo")
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resources.add"), level: 1 })).toBeVisible()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: i18n.t("common.cancel") })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: i18n.t("common.save") })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") })).toBeDisabled()
    expect(screen.getByRole("region", { name: "Básico" })).toBeVisible()
    expect(screen.getByRole("region", { name: "Preço e regras" })).toBeVisible()
    expect(screen.getByRole("region", { name: "Visual" })).toBeVisible()
  })

  it("protects dirty edits on unload, Cancel, breadcrumb, sidebar and Back until departure is confirmed", async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage(WRITE_PERMS, "/configuracoes/recursos/novo")
    const name = await screen.findByRole("textbox", { name: i18n.t("rentals.resources.form.name") })
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(unload()).toBe(false)
    await user.type(name, "Sala nova")
    expect(unload()).toBe(true)
    for (const departure of [
      screen.getAllByRole("button", { name: i18n.t("common.cancel") })[0]!,
      screen.getByRole("link", { name: "Dashboard" }),
      screen.getByRole("button", { name: "Back" }),
    ]) {
      await user.click(departure)
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
      await user.click(screen.getByRole("button", { name: i18n.t("common.cancel"), hidden: false }))
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
      expect(name).toHaveValue("Sala nova")
    }
    await user.clear(name)
    expect(unload()).toBe(false)
    await user.type(name, "Sala nova")
    await user.click(screen.getByRole("link", { name: "Dashboard" }))
    await user.click(await screen.findByRole("button", { name: i18n.t("fullPage.discard") }))
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeVisible()
    unmount()
    expect(unload()).toBe(false)
  })

  it("blocks Cancel, breadcrumb and sidebar departure while saving, then refreshes the resource list", async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof createRentalAsset>>) => void
    const saved = { id: RENTAL_ID, assetId: ASSET_ID, name: "Sala nova", isActive: true, requiresDeposit: true, schedulePolicy: "SlotGrid", unitId: UNIT_ID, type: "Location", totalQuantity: 1, queueEnabled: false } as const
    createMock.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    const user = userEvent.setup()
    renderPage(WRITE_PERMS, "/configuracoes/recursos/novo")
    const name = await screen.findByRole("textbox", { name: i18n.t("rentals.resources.form.name") })
    await user.type(name, "Sala nova")
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") }))
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    for (const button of [
      ...screen.getAllByRole("button", { name: i18n.t("common.cancel") }),
    ]) {
      expect(button).toBeDisabled()
      await user.click(button)
    }
    await user.click(screen.getByRole("link", { name: "Dashboard" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(name).toHaveValue("Sala nova")
    expect(listAssetsMock).not.toHaveBeenCalled()
    listAssetsMock.mockResolvedValue([saved])
    vi.useFakeTimers()
    try {
      await act(async () => { resolveSave(saved) })
      const unload = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(unload)
      expect(unload.defaultPrevented).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    } finally { vi.useRealTimers() }
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resources.title"), level: 1 })).toBeVisible()
    expect(await screen.findByText("Sala nova")).toBeVisible()
  })

  it("does not turn a missing edit ID into resource creation", async () => {
    renderPage(WRITE_PERMS, "/configuracoes/recursos/missing")
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("rentals.resources.editor.notFound"))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it("summarizes real resources by rental type, including pending deletions", async () => {
    const space = {
      id: RENTAL_ID, assetId: ASSET_ID, name: "Sala", unitId: UNIT_ID,
      isActive: true, requiresDeposit: true, schedulePolicy: "SlotGrid",
      type: "Location", totalQuantity: 1, queueEnabled: false, queueOpeningTime: null,
    } as const
    listAssetsMock.mockResolvedValue([
      { ...space, name: "Sala de reunião" },
      { ...space, id: "space-2", assetId: "asset-2", name: "Sala de trabalho" },
      { ...space, id: "good-1", assetId: "asset-3", name: "Projetor", type: "Good", totalQuantity: 6, scheduledDeletionAt: "2026-11-01T00:00:00Z" },
    ])

    renderPage()

    expect(await screen.findByText("3 recursos")).toBeInTheDocument()
    expect(screen.getByText("3 recursos").parentElement).toHaveTextContent("3 recursos · 2 espaços, 1 item")
    expect(screen.getByRole("button", { name: /Projetor/ })).toHaveTextContent("Exclusão Pendente")
  })

  it("lists rentables and offers create without inventory endpoints", async () => {
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
      },
    ])

    const { container } = renderPage()

    expect(await screen.findByText("Quadra 1")).toBeInTheDocument()
    expect(listAssetsMock).toHaveBeenCalled()
    expectNoForbiddenCopy(container)
  })

  it.each([
    ["pt-BR", "1 recurso · 0 espaços, 1 item"],
    ["en", "1 resource · 0 spaces, 1 item"],
    ["es", "1 recurso · 0 espacios, 1 artículo"],
  ])("uses localized singulars and zero plurals in %s without counting stock as resources", async (language, summary) => {
    await i18n.changeLanguage(language)
    listAssetsMock.mockResolvedValue([{
      id: RENTAL_ID, assetId: ASSET_ID, name: "Projetor", unitId: UNIT_ID,
      isActive: true, requiresDeposit: true, schedulePolicy: "SlotGrid",
      type: "Good", totalQuantity: 6, queueEnabled: false, queueOpeningTime: null,
    }])
    const { unmount } = renderPage()
    try {
      await screen.findByRole("button", { name: /Projetor/ })
      expect(screen.getByText(/1 recurso$|1 resource$/).parentElement).toHaveTextContent(summary)
    } finally {
      unmount()
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("announces loading without presenting a false empty state", async () => {
    let resolveAssets!: (assets: Awaited<ReturnType<typeof listAdminRentalAssets>>) => void
    listAssetsMock.mockReturnValue(new Promise((resolve) => { resolveAssets = resolve }))
    renderPage()

    expect(screen.getByRole("status")).toHaveAccessibleName(i18n.t("common.loading"))
    expect(screen.queryByText(i18n.t("rentals.resources.emptyTitle"))).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("rentals.resources.add") })).toBeDisabled()

    resolveAssets([])
    expect(await screen.findByText(i18n.t("rentals.resources.emptyTitle"))).toBeInTheDocument()
    for (const button of screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })) {
      expect(button).toBeEnabled()
    }
  })

  it("shows an existing resource's price, allowed durations, and capacity in the list and editor", async () => {
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "OpenHours",
        allowedDurationMinutes: "60,90",
        capacityPeople: 8,
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
      },
    ])
    getAssetPricingsMock.mockResolvedValue([
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        assetId: ASSET_ID,
        rentalAssetId: RENTAL_ID,
        dayOfWeek: "Monday" as const,
        startTime: "08:00:00",
        endTime: "18:00:00",
        pricePerHour: 45,
        pricingUnit: "Slot" as const,
        requiresDeposit: false,
        depositPercentage: 0,
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: null,
      },
    ].flatMap((row) => [
      // Legacy blank per-day row (R$ 0) must not become "A partir de: R$ 0,00".
      { ...row, dayOfWeek: "Tuesday" as const, pricePerHour: 0, pricingUnit: "Hour" as const },
      { ...row, pricePerHour: 90, pricingUnit: "Day" as const },
      row,
    ]))

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("link", { name: i18n.t("rentals.resourceWizard.open") })).toHaveAttribute(
      "href",
      `/configuracoes/recursos/${RENTAL_ID}/cadastro`,
    )
    const details = await screen.findByText(/A partir de: R\$ 45,00 por horário/)
    expect(details.parentElement).toHaveTextContent("Durações: 1 h, 90 min")
    expect(details.parentElement).toHaveTextContent("Capacidade: 8 pessoas")

    await user.click(screen.getByRole("button", { name: /Quadra 1/ }))
    expect(await screen.findAllByText(/A partir de: R\$ 45,00 por horário/)).toHaveLength(1)
  })

  it("shows empty rentables CTA when categories exist", async () => {
    const { container } = renderPage()

    expect(
      await screen.findByText(i18n.t("rentals.resources.emptyTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("rentals.resources.emptyDescription")),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })
        .length,
    ).toBeGreaterThan(0)
    expectNoForbiddenCopy(container)
  })

  it("replaces a raw FORBIDDEN load error with the translated denial", async () => {
    listAssetsMock.mockRejectedValue(new Error("FORBIDDEN"))
    renderPage(["rentals.assets.read"])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("rbac.errors.FORBIDDEN"),
    )
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(i18n.t("rbac.errors.FORBIDDEN"))
  })

  it("offers a retry after a loading failure", async () => {
    listAssetsMock.mockRejectedValueOnce(new Error("network failed"))
    renderPage()

    const retry = await screen.findByRole("button", { name: i18n.t("common.retry") })
    await userEvent.setup().click(retry)

    await waitFor(() => expect(listAssetsMock).toHaveBeenCalledTimes(2))
  })

  it("keeps resource creation available when there are no categories", async () => {
    listCategoriesMock.mockResolvedValue([])
    const { container } = renderPage()

    expect(
      await screen.findByText(i18n.t("rentals.resources.emptyTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") }).length,
    ).toBeGreaterThan(0)
    expectNoForbiddenCopy(container)
  })

  it.each([
    { label: "server stores it", storedAfter: 1, expectSuccess: true },
    { label: "server drops it (QA R18)", storedAfter: null, expectSuccess: false },
  ])("sends cancelCutoffHours=1 from the editor and toasts honestly when the $label", async ({ storedAfter, expectSuccess }) => {
    const existing = {
      id: RENTAL_ID, assetId: ASSET_ID, name: "Projetor Horario", isActive: true, requiresDeposit: true,
      schedulePolicy: "SlotGrid" as const, unitId: UNIT_ID, type: "Location" as const, totalQuantity: 1,
      queueEnabled: false, queueOpeningTime: null, categoryId: CATEGORY_ID, categoryName: "Quadra",
      familyId: FAMILY_ID, cancelCutoffHours: null, effectiveCancelCutoffHours: 2,
    }
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    listAssetsMock.mockResolvedValue([existing])
    updateMock.mockResolvedValue({ ...existing, cancelCutoffHours: storedAfter })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: /Projetor Horario/ }))
    await openPricingTab(user)
    await user.click(screen.getByRole("radio", { name: i18n.t("rentals.resources.form.cancelCutoffHours") }))
    await user.type(screen.getByRole("textbox", { name: i18n.t("rentals.resources.form.cancelCutoffHours") }), "1")
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0]?.[1]).toHaveProperty("cancelCutoffHours", 1)
    if (expectSuccess) {
      expect(toast.success).toHaveBeenCalledWith(i18n.t("rentals.resources.updateSuccess"))
      expect(toast.error).not.toHaveBeenCalled()
    } else {
      expect(toast.error).toHaveBeenCalledWith(i18n.t("rentals.resources.cutoffNotSaved"))
      expect(toast.success).not.toHaveBeenCalled()
    }
  })

  it("creates a rentable without requiring or sending an identifier", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )

    await screen.findByLabelText(i18n.t("rentals.resources.form.name"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.name")),
      "Quadra 1",
    )
    expect(
      screen.queryByRole("combobox", { name: i18n.t("rentals.resources.form.unit") }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("rentals.resources.form.category") }),
    )
    await user.click(await screen.findByRole("option", { name: "Quadra" }))

    await user.click(
      screen.getByRole("button", { name: i18n.t("cadastro.next") }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled()
    })

    const payload = createMock.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      name: "Quadra 1",
      unitId: UNIT_ID,
      categoryId: CATEGORY_ID,
      familyId: FAMILY_ID,
      rentalType: "Location",
    })
    expect(payload).not.toHaveProperty("maxAdvanceBookingDays")
    expect(payload).not.toHaveProperty("tag")
  })

  it("shows the unit field when the tenant has multiple units", async () => {
    const user = userEvent.setup()
    const secondUnitId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
      {
        id: secondUnitId,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Anexo",
        code: "ANEXO",
        isActive: true,
      },
    ])
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("rentals.resources.form.unit") }),
    )
    expect(await screen.findByRole("option", { name: "Sede" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Anexo" })).toBeInTheDocument()
  })

  it("offers inline unit creation only with core.units.write", async () => {
    const user = userEvent.setup()
    renderPage([...WRITE_PERMS, "core.units.write"])

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("rentals.resources.form.unit") }),
    )
    expect(
      await screen.findByRole("option", {
        name: i18n.t("rentals.resources.inlineCreate.unitAction"),
      }),
    ).toBeInTheDocument()
  })

  it("does not offer inline unit creation without core.units.write", async () => {
    const user = userEvent.setup()
    const secondUnitId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
      {
        id: secondUnitId,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Anexo",
        code: "ANEXO",
        isActive: true,
      },
    ])
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("rentals.resources.form.unit") }),
    )

    expect(screen.queryByRole("option", {
      name: i18n.t("rentals.resources.inlineCreate.unitAction"),
    })).not.toBeInTheDocument()
  })

  it("updates using the rental asset id from the list, not assetId", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
      },
    ])

    renderPage()
    await user.click(await screen.findByText("Quadra 1"))
    await screen.findByLabelText(i18n.t("rentals.resources.form.tag"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    )

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    expect(updateMock.mock.calls[0]?.[0]).toBe(RENTAL_ID)
    expect(updateMock.mock.calls[0]?.[0]).not.toBe(ASSET_ID)
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "maxAdvanceBookingDays",
    )
  })

  async function chooseHorizon(
    user: ReturnType<typeof userEvent.setup>,
    optionKey:
      | "rentals.resources.form.horizonInherit"
      | "rentals.resources.form.horizonUnlimited"
      | "rentals.resources.form.horizonDaysMode",
  ) {
    await openPricingTab(user)
    await user.click(
      screen.getByRole("radio", { name: i18n.t(optionKey) }),
    )
  }

  it("creates a resource with unlimited or a number of days", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )
    await screen.findByLabelText(i18n.t("rentals.resources.form.name"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.name")),
      "Quadra 1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await chooseHorizon(user, "rentals.resources.form.horizonUnlimited")
    await user.click(
      screen.getByRole("button", { name: i18n.t("cadastro.next") }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled()
    })
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      maxAdvanceBookingDays: null,
    })
  })

  it("rejects a resource horizon outside 0..3650 and sends a valid number", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )
    await screen.findByLabelText(i18n.t("rentals.resources.form.name"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.name")),
      "Space 1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "S-01",
    )
    await chooseHorizon(user, "rentals.resources.form.horizonDaysMode")

    const days = screen.getByLabelText(i18n.t("rentals.resources.form.horizonDays"))
    const save = screen.getByRole("button", {
      name: i18n.t("cadastro.next"),
    })
    expect(save).toBeDisabled()
    await user.type(days, "3651")
    expect(save).toBeDisabled()

    await user.clear(days)
    await user.type(days, "21")
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled()
    })
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      maxAdvanceBookingDays: 21,
    })
  })

  it("identifies the resource override as the effective horizon source", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        maxAdvanceBookingDays: 8,
        effectiveMaxAdvanceBookingDays: 8,
      },
    ])

    const { unmount } = renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await openPricingTab(user)
    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.horizonEffectiveSourceResource", {
          count: 8,
        }),
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    )
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "maxAdvanceBookingDays",
    )

    unmount()
    updateMock.mockClear()
    renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await chooseHorizon(user, "rentals.resources.form.horizonInherit")
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    )
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    expect(updateMock.mock.calls[0]?.[1]).toMatchObject({
      maxAdvanceBookingDays: null,
    })
  })

  it("identifies the booking policy as the inherited effective horizon source", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        maxAdvanceBookingDays: null,
        effectiveMaxAdvanceBookingDays: 8,
      },
    ])

    renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await openPricingTab(user)

    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.horizonEffectiveSourcePolicy", {
          count: 8,
        }),
      ),
    ).toBeInTheDocument()
  })

  it("disables the horizon when the user can only read the resource", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        maxAdvanceBookingDays: null,
        effectiveMaxAdvanceBookingDays: null,
      },
    ])
    renderPage(["rentals.assets.read"])

    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await openPricingTab(user)
    expect(
      screen.getByRole("radio", {
        name: i18n.t("rentals.resources.form.horizonInherit"),
      }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.horizonEffectiveSourcePolicy", {
          context: "unlimited",
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    ).toBeDisabled()
    expect(updateMock).not.toHaveBeenCalled()
  })


  async function chooseCancelCutoff(
    user: ReturnType<typeof userEvent.setup>,
    optionKey:
      | "rentals.resources.form.cancelCutoffInherit"
      | "rentals.resources.form.cancelCutoffNone"
      | "rentals.resources.form.cancelCutoffHours",
  ) {
    await openPricingTab(user)
    await user.click(
      screen.getByRole("radio", { name: i18n.t(optionKey) }),
    )
  }

  it("creates a resource with unlimited or a number of days", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )
    await screen.findByLabelText(i18n.t("rentals.resources.form.name"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.name")),
      "Quadra 1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await chooseCancelCutoff(user, "rentals.resources.form.cancelCutoffNone")
    await user.click(
      screen.getByRole("button", { name: i18n.t("cadastro.next") }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled()
    })
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      // "Sem prazo" is an explicit 0 so it overrides the tenant cutoff.
      cancelCutoffHours: 0,
    })
  })

  it("rejects a resource cancelCutoff outside 0..8760 and sends a valid number", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(i18n.t("rentals.resources.emptyTitle"))
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("rentals.resources.add") })[0]!,
    )
    await screen.findByLabelText(i18n.t("rentals.resources.form.name"))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.name")),
      "Space 1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "S-01",
    )
    await chooseCancelCutoff(user, "rentals.resources.form.cancelCutoffHours")

    const days = screen.getByRole("textbox", { name: i18n.t("rentals.resources.form.cancelCutoffHours") })
    const save = screen.getByRole("button", {
      name: i18n.t("cadastro.next"),
    })
    expect(save).toBeDisabled()
    await user.type(days, "8761")
    expect(save).toBeDisabled()

    await user.clear(days)
    await user.type(days, "21")
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled()
    })
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      cancelCutoffHours: 21,
    })
  })

  it("clears a stored override with the tenant default and keeps an unchanged number omitted", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        cancelCutoffHours: 8,
        effectiveCancelCutoffHours: 8,
      },
    ])

    const { unmount } = renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await openPricingTab(user)
    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.cancelCutoffEffectiveHours", { count: 8 }),
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    )
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "cancelCutoffHours",
    )

    unmount()
    updateMock.mockClear()
    renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await user.type(
      screen.getByLabelText(i18n.t("rentals.resources.form.tag")),
      "Q-01",
    )
    await chooseCancelCutoff(user, "rentals.resources.form.cancelCutoffInherit")
    await user.click(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    )
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    expect(updateMock.mock.calls[0]?.[1]).toMatchObject({
      cancelCutoffHours: null,
    })
  })

  it("disables the cancelCutoff when the user can only read the resource", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        cancelCutoffHours: null,
        effectiveCancelCutoffHours: null,
      },
    ])
    renderPage(["rentals.assets.read"])

    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await openPricingTab(user)
    expect(
      screen.getByRole("radio", {
        name: i18n.t("rentals.resources.form.cancelCutoffInherit"),
      }),
    ).toBeDisabled()
    expect(
      screen.getByText(i18n.t("rentals.resources.form.cancelCutoffEffectiveNone")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    ).toBeDisabled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("uses the singular form for a 1-hour effective cancellation cutoff", async () => {
    const user = userEvent.setup()
    listAssetsMock.mockResolvedValue([
      {
        id: RENTAL_ID,
        assetId: ASSET_ID,
        name: "Quadra 1",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: UNIT_ID,
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
        queueOpeningTime: null,
        categoryId: CATEGORY_ID,
        categoryName: "Quadra",
        cancelCutoffHours: 1,
        effectiveCancelCutoffHours: 1,
      },
    ])
    renderPage()

    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await openPricingTab(user)
    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.cancelCutoffEffectiveHours", { count: 1 }),
      ),
    ).toBeInTheDocument()
  })
})
