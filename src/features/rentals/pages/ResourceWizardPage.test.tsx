import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    isLoading: false,
    isTrial: false,
    isTrialReadOnly: false,
    trialEndsAt: undefined,
    trialPurgeAt: undefined,
  }),
}))

vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()
  return {
    ...actual,
    listAdminRentalAssets: vi.fn(),
    listOccupancyKinds: vi.fn(),
    listScheduleTemplates: vi.fn(),
    updateRentalSchedulePolicy: vi.fn(),
    seedDefaultHourlyTemplates: vi.fn(),
    createOccupancyKind: vi.fn(),
    updateOccupancyKind: vi.fn(),
  }
})

vi.mock("@/features/rentals/services/rentalResourcesService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/rentalResourcesService")>()
  return { ...actual, updateRentalAsset: vi.fn() }
})

vi.mock("@/features/assets/services/rentalPricingService", () => ({
  getAssetPricings: vi.fn(),
  bulkApplyAssetPricings: vi.fn(),
  createAssetPricing: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantModuleMenuItems: vi.fn(),
  createModuleMenuItem: vi.fn(),
  updateModuleMenuItem: vi.fn(),
}))

vi.mock("@/features/rentals/services/reservationsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/reservationsService")>()
  return { ...actual, listAdminReservations: vi.fn() }
})

vi.mock("@/features/rentals/services/staffResourceQueueService", () => ({
  fetchStaffResourceQueue: vi.fn(),
}))

import { getAssetPricings } from "@/features/assets/services/rentalPricingService"
import { ResourceWizardPage } from "@/features/rentals/pages/ResourceWizardPage"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import {
  createOccupancyKind,
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
} from "@/features/rentals/services/scheduleService"
import { fetchStaffResourceQueue } from "@/features/rentals/services/staffResourceQueueService"
import {
  createModuleMenuItem,
  listTenantModuleMenuItems,
} from "@/features/tenantPortal/services/tenantPortalService"

const RENTAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const asset = {
  id: RENTAL_ID,
  assetId: ASSET_ID,
  name: "Sala Reunião A",
  isActive: true,
  requiresDeposit: false,
  schedulePolicy: "SlotGrid",
  openTime: null,
  closeTime: null,
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  type: "Location",
  totalQuantity: 1,
  queueEnabled: true,
  queueOpeningTime: null,
  categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  categoryName: "Sala",
  familyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  tag: "SL-01",
  location: "Bloco A",
} as AdminRentalAsset

const FULL_ACCESS = [
  "rentals.assets.read",
  "rentals.assets.write",
  "core.module_menu.read",
  "core.module_menu.write",
  "rentals.occupancy_kinds.read",
  "rentals.occupancy_kinds.write",
  "rentals.schedule.read",
  "rentals.schedule.write",
  "rentals.pricing.read",
  "rentals.pricing.bulk_write",
  "rentals.reservations.read",
]

function renderWizard(permissions: readonly string[] = FULL_ACCESS, path = `/configuracoes/recursos/${RENTAL_ID}/assistente`) {
  const router = createMemoryRouter([
    {
      path: "/configuracoes/recursos/:id/assistente",
      element: (
        <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
          <ResourceWizardPage />
        </TestPermissionProvider>
      ),
    },
  ], { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe("ResourceWizardPage", () => {
  beforeEach(() => {
    vi.mocked(listAdminRentalAssets).mockReset()
    vi.mocked(listOccupancyKinds).mockReset()
    vi.mocked(listScheduleTemplates).mockReset()
    vi.mocked(getAssetPricings).mockReset()
    vi.mocked(listTenantModuleMenuItems).mockReset()
    vi.mocked(createModuleMenuItem).mockReset()
    vi.mocked(listAdminReservations).mockReset()
    vi.mocked(fetchStaffResourceQueue).mockReset()
    vi.mocked(createOccupancyKind).mockReset()

    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset])
    vi.mocked(listOccupancyKinds).mockResolvedValue([])
    vi.mocked(listScheduleTemplates).mockResolvedValue([])
    vi.mocked(getAssetPricings).mockResolvedValue([])
    vi.mocked(listTenantModuleMenuItems).mockResolvedValue([])
    vi.mocked(createModuleMenuItem).mockResolvedValue({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      moduleName: "rentals",
      label: "Reservar horário",
      sortOrder: 1,
      isActive: true,
    })
    vi.mocked(listAdminReservations).mockResolvedValue([])
    vi.mocked(fetchStaffResourceQueue).mockResolvedValue({ status: "unavailable" })
  })

  it("moves between steps with the stepper and back/next, and shows the queue as unavailable", async () => {
    const user = userEvent.setup()
    renderWizard()

    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resourceWizard.checklistTitle") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("rentals.resourceWizard.back") })).toBeDisabled()

    await user.click(screen.getAllByRole("button", { name: i18n.t("rentals.resourceWizard.actions.openStep") })[0]!)
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resourceWizard.rules.title") })).toBeInTheDocument()

    const stepper = screen.getAllByRole("navigation", { name: i18n.t("rentals.resourceWizard.stepperLabel") })[0]!
    await user.click(within(stepper).getByRole("button", { name: /Agenda$/ }))
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resourceWizard.agenda.title") })).toBeInTheDocument()
    expect(await screen.findByText(i18n.t("rentals.resourceWizard.agenda.queueUnavailable"))).toBeInTheDocument()
    expect(screen.queryByText("Ana")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: i18n.t("rentals.resourceWizard.back") }))
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resourceWizard.prices.title") })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: i18n.t("rentals.resourceWizard.next") }))
    expect(await screen.findByRole("heading", { name: i18n.t("rentals.resourceWizard.agenda.title") })).toBeInTheDocument()
    expect(fetchStaffResourceQueue).toHaveBeenCalledWith(RENTAL_ID, expect.any(String))
  })

  it("publishes the customer menu from the checklist", async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(await screen.findByRole("button", { name: i18n.t("rentals.resourceWizard.actions.createMenu") }))
    expect(createModuleMenuItem).toHaveBeenCalledWith(expect.objectContaining({
      moduleName: "rentals",
      isActive: true,
    }))
  })

  it("explains a missing permission instead of failing the step", async () => {
    renderWizard(FULL_ACCESS.filter((permission) => permission !== "rentals.schedule.read"), `/configuracoes/recursos/${RENTAL_ID}/assistente?passo=rules`)
    expect(await screen.findByText(i18n.t("rentals.resourceWizard.permission"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("rentals.schedule.seedTemplates") })).not.toBeInTheDocument()
  })

  it("hides the week's bookings when the person cannot read reservations", async () => {
    renderWizard(
      FULL_ACCESS.filter((permission) => permission !== "rentals.reservations.read"),
      `/configuracoes/recursos/${RENTAL_ID}/assistente?passo=agenda`,
    )
    expect(await screen.findAllByText(i18n.t("rentals.resourceWizard.permission"))).not.toHaveLength(0)
    expect(listAdminReservations).not.toHaveBeenCalled()
    expect(fetchStaffResourceQueue).not.toHaveBeenCalled()
    expect(await screen.findByText(i18n.t("rentals.resourceWizard.agenda.queueForbidden"))).toBeInTheDocument()
  })
})
