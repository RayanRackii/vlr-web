import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { SchedulePage } from "./SchedulePage"
import i18n from "@/lib/i18n"
import {
  applyWeeklyRule,
  deleteScheduleTemplate,
  listAdminRentalAssets,
  listOccupancyKinds,
  listScheduleTemplates,
  updateRentalSchedulePolicyBulk,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
} from "../services/scheduleService"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({ DailyAgendaTab: () => null }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn(),
  listOccupancyKinds: vi.fn(),
  listScheduleTemplates: vi.fn(),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
  applyWeeklyRule: vi.fn(),
  deleteScheduleTemplate: vi.fn(),
  updateRentalSchedulePolicyBulk: vi.fn(),
}))

function asset(extra: Partial<AdminRentalAsset> = {}): AdminRentalAsset {
  return {
    id: "room", assetId: "asset", name: "Sala 1", isActive: true, requiresDeposit: false,
    schedulePolicy: "SlotGrid", openTime: null, closeTime: null, allowedDurationMinutes: "60",
    unitId: "unit", type: "Location", totalQuantity: 1, queueEnabled: false, queueOpeningTime: null,
    categoryId: null, categoryName: null, ...extra,
  } as AdminRentalAsset
}
const kinds: OccupancyKind[] = [
  { id: "lesson", key: "lesson", label: "Aula", isActive: true, isBookableByCustomer: true, blocksCapacity: true, sortOrder: 0 },
  { id: "open-kind", key: "open", label: "Aberto", isActive: true, isBookableByCustomer: true, blocksCapacity: true, sortOrder: 1 },
]
function hourly(day: string, from: number, to: number): ScheduleTemplate[] {
  return Array.from({ length: to - from }, (_, index) => ({
    id: `${day}-${from + index}`, rentalAssetId: "room", assetName: "Sala 1", dayOfWeek: day,
    startTime: `${String(from + index).padStart(2, "0")}:00:00`, endTime: `${String(from + index + 1).padStart(2, "0")}:00:00`,
    occupancyKindId: "open-kind", occupancyKindLabel: "Aberto", label: null, isActive: true,
  }))
}

const day = (name: string) => i18n.t(`rentals.schedule.days.${name}`)
const switchOf = (name: string) => screen.getByRole("switch", { name: new RegExp(day(name)) })

async function renderHours() {
  render(<MemoryRouter><SchedulePage /></MemoryRouter>)
  const monday = await screen.findByRole("switch", { name: new RegExp(day("Monday")) })
  await waitFor(() => expect(monday).toBeChecked())
}

describe("SchedulePage business hours save", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset()])
    vi.mocked(listOccupancyKinds).mockResolvedValue(kinds)
    vi.mocked(listScheduleTemplates).mockResolvedValue(hourly("Monday", 8, 12))
    vi.mocked(applyWeeklyRule).mockResolvedValue({ created: 4, updated: 0, skipped: 0 })
    vi.mocked(deleteScheduleTemplate).mockResolvedValue(undefined)
    vi.mocked(updateRentalSchedulePolicyBulk).mockResolvedValue([])
  })

  it("applies a new weekday with the Open occupancy kind and reports a summary", async () => {
    const user = userEvent.setup()
    await renderHours()
    await user.click(switchOf("Saturday"))
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.save") }))
    await waitFor(() => expect(applyWeeklyRule).toHaveBeenCalledTimes(1))
    expect(applyWeeklyRule).toHaveBeenCalledWith({
      rentalAssetIds: ["room"], daysOfWeek: ["Saturday"], openTime: "08:00", closeTime: "18:00",
      slotMinutes: 60, occupancyKindId: "open-kind",
    })
    expect(deleteScheduleTemplate).not.toHaveBeenCalled()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      i18n.t("rentals.schedule.hours.saveSuccess", { created: 4, updated: 0, removed: 0 }),
    ))
  })

  it("removes the templates of a closed weekday after the confirmation and counts them", async () => {
    const user = userEvent.setup()
    await renderHours()
    await user.click(switchOf("Monday"))
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.save") }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("rentals.schedule.hours.confirm.action") }))
    await waitFor(() => expect(deleteScheduleTemplate).toHaveBeenCalledTimes(4))
    expect(applyWeeklyRule).not.toHaveBeenCalled()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      i18n.t("rentals.schedule.hours.saveSuccess", { created: 0, updated: 0, removed: 4 }),
    ))
  })

  it("reports each failed step and does not hide it behind a success toast", async () => {
    vi.mocked(applyWeeklyRule).mockRejectedValue(new Error("Horário inválido"))
    vi.mocked(deleteScheduleTemplate).mockRejectedValueOnce(new Error("Sem permissão"))
    const user = userEvent.setup()
    await renderHours()
    await user.click(switchOf("Saturday"))
    await user.click(switchOf("Monday"))
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.save") }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("rentals.schedule.hours.confirm.action") }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(`${day("Saturday")}: Horário inválido`)
    expect(alert).toHaveTextContent("Sem permissão")
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(i18n.t("rentals.schedule.hours.saveFailed", { count: 2 }))
  })

  it("keeps the overall open and close time of open-hours resources in sync", async () => {
    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset({ schedulePolicy: "OpenHours", openTime: "08:00:00", closeTime: "12:00:00", allowedDurationMinutes: "60,90" })])
    vi.mocked(listScheduleTemplates).mockResolvedValue([])
    const user = userEvent.setup()
    render(<MemoryRouter><SchedulePage /></MemoryRouter>)
    const monday = await screen.findByRole("switch", { name: new RegExp(day("Monday")) })
    await waitFor(() => expect(monday).toBeChecked())
    fireEvent.change(screen.getByLabelText(`${day("Sunday")}: ${i18n.t("rentals.schedule.hours.closes")}`), { target: { value: "18:00" } })
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.save") }))
    await waitFor(() => expect(updateRentalSchedulePolicyBulk).toHaveBeenCalledWith(["room"], {
      schedulePolicy: "OpenHours", openTime: "08:00", closeTime: "18:00", allowedDurationMinutes: "60,90",
    }))
  })
})
