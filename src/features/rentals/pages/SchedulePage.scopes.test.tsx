import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SchedulePage } from "./SchedulePage"
import i18n from "@/lib/i18n"
import {
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
  type AdminRentalAsset,
  type ScheduleTemplate,
} from "../services/scheduleService"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({
  DailyAgendaTab: ({ selectedRentalAssetIds }: { selectedRentalAssetIds: string[] }) => (
    <output aria-label="Day resources">{selectedRentalAssetIds.join(",")}</output>
  ),
}))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn(),
  listOccupancyKinds: vi.fn(),
  listScheduleTemplates: vi.fn(),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
}))

function asset(id: string): AdminRentalAsset {
  return {
    id, assetId: `a-${id}`, name: `Sala ${id}`, isActive: true, requiresDeposit: false, schedulePolicy: "SlotGrid",
    unitId: "unit", type: "Location", totalQuantity: 1, queueEnabled: false,
  } as AdminRentalAsset
}
function hourly(rentalAssetId: string, from: number, to: number): ScheduleTemplate[] {
  return Array.from({ length: to - from }, (_, index) => ({
    id: `${rentalAssetId}-${from + index}`, rentalAssetId, assetName: rentalAssetId, dayOfWeek: "Monday",
    startTime: `${String(from + index).padStart(2, "0")}:00:00`, endTime: `${String(from + index + 1).padStart(2, "0")}:00:00`,
    occupancyKindId: "open", occupancyKindLabel: "Aberto", label: null, isActive: true,
  }))
}

describe("SchedulePage scopes", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
    const all = [...hourly("a", 8, 22), ...hourly("b", 8, 22), ...hourly("c", 9, 12)]
    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset("a"), asset("b"), asset("c")])
    vi.mocked(listOccupancyKinds).mockResolvedValue([])
    vi.mocked(listScheduleTemplates).mockImplementation((async (_one: unknown, ids?: readonly string[], day?: string) =>
      all.filter((item) => (!ids || ids.includes(item.rentalAssetId)) && (!day || item.dayOfWeek === day))) as never)
  })

  it("keeps the hours scope local: the day tab still shows every resource", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SchedulePage /></MemoryRouter>)
    const largest = await screen.findByRole("radio", {
      name: `${i18n.t("rentals.schedule.hours.groupResources", { count: 2 })} · Seg 08:00–22:00`,
    })
    await waitFor(() => expect(largest).toHaveAttribute("aria-checked", "true"))
    await user.click(screen.getByRole("tab", { name: i18n.t("rentals.schedule.tabs.daily") }))
    expect(screen.getByLabelText("Day resources")).toHaveTextContent("a,b,c")
  })
})
