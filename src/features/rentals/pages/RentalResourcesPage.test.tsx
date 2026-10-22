import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
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

vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn(),
}))

vi.mock("@/features/rentals/services/rentalResourcesService", () => ({
  listRentalAssetCategories: vi.fn(),
  listRentalAssetFamilies: vi.fn(),
  createRentalAsset: vi.fn(),
  updateRentalAsset: vi.fn(),
}))

import { getUnits } from "@/features/assets/services/unitsService"
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

const WRITE_PERMS = ["rentals.assets.read", "rentals.assets.write"] as const

function renderPage(permissions: readonly string[] = WRITE_PERMS) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
        <RentalResourcesPage />
      </TestPermissionProvider>
    </MemoryRouter>,
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
    getUnitsMock.mockRejectedValue(new Error("FORBIDDEN"))
    renderPage(["rentals.assets.read"])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("rbac.errors.FORBIDDEN"),
    )
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(i18n.t("rbac.errors.FORBIDDEN"))
  })

  it("offers a retry after a loading failure", async () => {
    getUnitsMock.mockRejectedValueOnce(new Error("network failed"))
    renderPage()

    const retry = await screen.findByRole("button", { name: i18n.t("common.retry") })
    await userEvent.setup().click(retry)

    await waitFor(() => expect(getUnitsMock).toHaveBeenCalledTimes(2))
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
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") }),
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
    getUnitsMock.mockResolvedValueOnce([
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
    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("rentals.resources.form.horizonLabel"),
      }),
    )
    await user.click(
      await screen.findByRole("option", { name: i18n.t(optionKey) }),
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
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveCreate") }),
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
      name: i18n.t("rentals.resources.saveCreate"),
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
        maxAdvanceBookingDays: 8,
        effectiveMaxAdvanceBookingDays: 8,
      },
    ])

    const { unmount } = renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    expect(
      screen.getByText(
        i18n.t("rentals.resources.form.horizonEffectiveDays", { count: 8 }),
      ),
    ).toBeInTheDocument()
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
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "maxAdvanceBookingDays",
    )

    unmount()
    updateMock.mockClear()
    renderPage()
    await user.click(await screen.findByRole("button", { name: /Quadra 1/ }))
    await chooseHorizon(user, "rentals.resources.form.horizonInherit")
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
    expect(updateMock.mock.calls[0]?.[1]).toMatchObject({
      maxAdvanceBookingDays: null,
    })
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
    expect(
      screen.getByRole("combobox", {
        name: i18n.t("rentals.resources.form.horizonLabel"),
      }),
    ).toBeDisabled()
    expect(
      screen.getByText(i18n.t("rentals.resources.form.horizonEffectiveUnlimited")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("rentals.resources.saveEdit") }),
    ).toBeDisabled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
