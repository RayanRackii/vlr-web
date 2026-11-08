import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { SchedulePage } from "./SchedulePage"
import type { WeeklyTemplatesTab } from "../components/schedule/WeeklyTemplatesTab"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({ DailyAgendaTab: () => null }))
vi.mock("@/features/rentals/components/schedule/WeeklyTemplatesTab", () => ({
  WeeklyTemplatesTab: ({ onCellClick, templateEditor }: ComponentProps<typeof WeeklyTemplatesTab>) => <>
    {["08:00", "10:00"].map((startTime) => <button key={startTime} onClick={() => onCellClick({
      rentalAssetId: "room", assetName: "Sala", dayOfWeek: "Monday", startTime,
      endTime: "11:00", origin: "empty", template: null,
    })}>{startTime}</button>)}
    <button onClick={() => onCellClick({
      rentalAssetId: "other-room", assetName: "Outra sala", dayOfWeek: "Monday", startTime: "08:00",
      endTime: "11:00", origin: "empty", template: null,
    })}>Outra sala 08:00</button>
    {templateEditor}
  </>,
}))

it("preserves dirty weekly edits when switching is cancelled and discards only on confirmation or explicit Cancel", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const user = userEvent.setup()
  render(<SchedulePage />)
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  await user.click(screen.getByRole("button", { name: "08:00" }))
  const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
  await user.type(label(), "Rascunho")
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(label()).toHaveValue("Rascunho")
  expect(confirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "10:00" }))
  expect(confirm).toHaveBeenCalledWith(i18n.t("fullPage.leaveConfirm"))
  expect(label()).toHaveValue("Rascunho")
  expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("08:00")
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole("button", { name: "10:00" }))
  expect(label()).toHaveValue("")
  expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("10:00")
  await user.type(label(), "Descartar")
  await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
  expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
  confirm.mockClear()
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(label()).toHaveValue("")
  expect(confirm).not.toHaveBeenCalled()
  confirm.mockRestore()
})

it("resets same-time weekly drafts only after confirming a different resource and discards on explicit Cancel", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const user = userEvent.setup()
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho da sala")
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(confirm).toHaveBeenCalledWith(i18n.t("fullPage.leaveConfirm"))
    expect(label()).toHaveValue("Rascunho da sala")
    expect(screen.getByText("Sala", { exact: true })).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(screen.getByText("Outra sala", { exact: true })).toBeInTheDocument()
    expect(label()).toHaveValue("")
    expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("08:00")

    confirm.mockClear()
    await user.type(label(), "Rascunho da outra sala")
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(label()).toHaveValue("Rascunho da outra sala")
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(label()).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "08:00" }))
    expect(label()).toHaveValue("")
    expect(screen.getByText("Sala", { exact: true })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  } finally {
    confirm.mockRestore()
  }
})
