import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SchedulePage } from "./SchedulePage"
import type { DayResourceGridCellPayload } from "@/features/rentals/components/schedule/DayResourceGrid"
import type { AdminDaySlot, OccupancyKind } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"

const { KIND, TARGET } = vi.hoisted(() => {
  const KIND: OccupancyKind = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "available",
  label: "Disponível",
  isActive: true,
  isBookableByCustomer: true,
  blocksCapacity: true,
  sortOrder: 0,
}

const SLOT: AdminDaySlot = {
  id: "22222222-2222-4222-8222-222222222222",
  rentalAssetId: "33333333-3333-4333-8333-333333333333",
  assetName: "Sala 1",
  date: "2026-11-02",
  startTime: "09:00:00",
  endTime: "10:00:00",
  occupancyKindId: KIND.id,
  occupancyKindKey: KIND.key,
  occupancyKindLabel: KIND.label,
  isBookableByCustomer: true,
  label: "",
  status: "Open",
  reservationId: null,
  isDerived: false,
  source: "WeeklyDefault",
  schedulePolicy: "SlotGrid",
  supportsEntireRecurrence: false,
  isInternalUseOrigin: false,
  owningCatalogOrderId: null,
  workStartTime: null,
  workEndTime: null,
}

const TARGET: DayResourceGridCellPayload = {
  rentalAssetId: SLOT.rentalAssetId,
  assetName: SLOT.assetName,
  startTime: SLOT.startTime,
  endTime: SLOT.endTime,
  occupancy: null,
  date: SLOT.date,
  slot: SLOT,
}
  return { KIND, TARGET }
})

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({
  DailyAgendaTab: ({ onSlotOrCellClick }: { onSlotOrCellClick: (target: DayResourceGridCellPayload) => void }) => (
    <button type="button" onClick={() => onSlotOrCellClick(TARGET)}>Abrir horário</button>
  ),
}))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  listOccupancyKinds: vi.fn().mockResolvedValue([KIND]),
  listScheduleTemplates: vi.fn().mockResolvedValue([]),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
}))

function renderAgenda() {
  const router = createMemoryRouter([
    { path: "/configuracoes/agenda", element: <SchedulePage /> },
  ], { initialEntries: ["/configuracoes/agenda"] })
  return render(<RouterProvider router={router} />)
}

describe("SchedulePage day slot leave", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("discards the draft when Sair reopens the same slot", async () => {
    const user = userEvent.setup()
    renderAgenda()
    const open = await screen.findByRole("button", { name: "Abrir horário" })
    await user.click(open)
    const label = await screen.findByLabelText(i18n.t("rentals.schedule.templates.label"))
    await user.type(label, "Manhã")
    expect(label).toHaveValue("Manhã")

    await user.click(open)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: i18n.t("fullPage.leave") }))

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t("rentals.schedule.templates.label"))).toHaveValue("")
    })
  })
})
