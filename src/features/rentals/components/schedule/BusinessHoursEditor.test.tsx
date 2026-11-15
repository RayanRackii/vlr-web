import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BusinessHoursEditor } from "./BusinessHoursEditor"
import type { BusinessHoursPlan } from "./businessHoursModel"
import i18n from "@/lib/i18n"
import type { AdminRentalAsset, DayOfWeekName, ScheduleTemplate } from "@/features/rentals/services/scheduleService"

function asset(id: string): AdminRentalAsset {
  return {
    id, assetId: `a-${id}`, name: `Sala ${id}`, isActive: true, requiresDeposit: false,
    unitId: "unit", type: "Location", totalQuantity: 1, schedulePolicy: "SlotGrid", queueEnabled: false,
  } as AdminRentalAsset
}

let counter = 0
function hourly(rentalAssetId: string, dayOfWeek: DayOfWeekName, from: number, to: number): ScheduleTemplate[] {
  return Array.from({ length: to - from }, (_, index) => {
    counter += 1
    const start = String(from + index).padStart(2, "0")
    const end = String(from + index + 1).padStart(2, "0")
    return {
      id: `t-${counter}`, rentalAssetId, assetName: rentalAssetId, dayOfWeek, startTime: `${start}:00:00`, endTime: `${end}:00:00`,
      occupancyKindId: "open", occupancyKindLabel: "Aberto", label: null, isActive: true,
    }
  })
}

const day = (name: DayOfWeekName) => i18n.t(`rentals.schedule.days.${name}`)
const switchOf = (name: DayOfWeekName) => screen.getByRole("switch", { name: new RegExp(day(name)) })
const timeOf = (name: DayOfWeekName, kind: "opens" | "closes") =>
  screen.getByLabelText(`${day(name)}: ${i18n.t(`rentals.schedule.hours.${kind}`)}`)

function renderEditor(overrides: Partial<React.ComponentProps<typeof BusinessHoursEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue({ ok: true, errors: [] })
  const props = {
    assets: [asset("a")],
    selectedRentalAssetIds: ["a"],
    scheduleTemplates: [...hourly("a", "Monday", 8, 18), ...hourly("a", "Tuesday", 8, 18)],
    loadingTemplates: false,
    busy: false,
    busyAction: null,
    readOnly: false,
    onSelectedRentalAssetIdsChange: vi.fn(),
    onSave,
    ...overrides,
  } satisfies React.ComponentProps<typeof BusinessHoursEditor>
  render(<BusinessHoursEditor {...props} />)
  return { onSave, props }
}

const saveButton = () => screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.save") })

describe("BusinessHoursEditor", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
  })

  it("prefills one row per weekday from the current templates and starts clean", () => {
    renderEditor()
    expect(switchOf("Monday")).toBeChecked()
    expect(timeOf("Monday", "opens")).toHaveValue("08:00")
    expect(timeOf("Monday", "closes")).toHaveValue("18:00")
    expect(switchOf("Sunday")).not.toBeChecked()
    expect(screen.getAllByRole("switch")).toHaveLength(7)
    expect(screen.getByRole("radio", { name: i18n.t("rentals.schedule.hours.slotUnit", { count: 60 }) })).toHaveAttribute("aria-checked", "true")
    expect(saveButton()).toBeDisabled()
  })

  it("applies each group of identical weekdays once, with the chosen slot length", async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await user.click(switchOf("Saturday"))
    fireEvent.change(timeOf("Saturday", "closes"), { target: { value: "14:00" } })
    await user.click(screen.getByRole("radio", { name: i18n.t("rentals.schedule.hours.slotUnit", { count: 30 }) }))
    await user.click(saveButton())
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
    const plan = onSave.mock.calls[0][0] as BusinessHoursPlan
    expect(plan.slotMinutes).toBe(30)
    expect(plan.removals).toEqual([])
    expect(plan.groups).toEqual([
      { days: ["Monday", "Tuesday"], openTime: "08:00", closeTime: "18:00" },
      { days: ["Saturday"], openTime: "08:00", closeTime: "14:00" },
    ])
  })

  it("copies the first open day to every weekday", async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.copyToAll") }))
    for (const name of ["Wednesday", "Sunday"] as const) {
      expect(switchOf(name)).toBeChecked()
      expect(timeOf(name, "closes")).toHaveValue("18:00")
    }
    await user.click(saveButton())
    const plan = onSave.mock.calls[0][0] as BusinessHoursPlan
    // Monday and Tuesday already had these hours, so only the five other days are applied.
    expect(plan.groups).toEqual([{ days: ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], openTime: "08:00", closeTime: "18:00" }])
  })

  it("lists what a closed weekday removes and only saves after confirming", async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    await user.click(switchOf("Tuesday"))
    await user.click(saveButton())
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(i18n.t("rentals.schedule.hours.confirm.removeClosed", { day: day("Tuesday"), count: 10, resources: 1 }))
    expect(onSave).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
    expect(onSave).not.toHaveBeenCalled()
    await user.click(saveButton())
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("rentals.schedule.hours.confirm.action") }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect((onSave.mock.calls[0][0] as BusinessHoursPlan).removals).toHaveLength(10)
  })

  it("shows every failed step from the save and keeps the editor usable", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: false, errors: ["Sábado: horário inválido", "Não foi possível remover 2 horário(s): erro"] })
    renderEditor({ onSave })
    await user.click(switchOf("Saturday"))
    await user.click(saveButton())
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Sábado: horário inválido")
    expect(alert).toHaveTextContent("Não foi possível remover 2 horário(s): erro")
  })

  it("blocks Save with a message while the hours are invalid", async () => {
    const user = userEvent.setup()
    const { onSave } = renderEditor()
    fireEvent.change(timeOf("Monday", "opens"), { target: { value: "19:00" } })
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("rentals.schedule.hours.problem.invalidTimes"))
    fireEvent.change(timeOf("Monday", "opens"), { target: { value: "08:00" } })
    fireEvent.change(timeOf("Monday", "closes"), { target: { value: "20:00" } })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledOnce()
  })

  it("leaves weekdays that differ between resources empty and untouched, and asks for a slot length when it differs", async () => {
    const user = userEvent.setup()
    const half: ScheduleTemplate = { ...hourly("b", "Monday", 9, 10)[0], endTime: "09:30:00" }
    const { onSave } = renderEditor({
      assets: [asset("a"), asset("b")],
      selectedRentalAssetIds: ["a", "b"],
      scheduleTemplates: [...hourly("a", "Monday", 8, 18), ...hourly("b", "Monday", 9, 18).slice(1), half],
    })
    expect(screen.getAllByText(i18n.t("rentals.schedule.hours.differs"))).toHaveLength(1)
    expect(screen.queryByLabelText(`${day("Monday")}: ${i18n.t("rentals.schedule.hours.opens")}`)).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("rentals.schedule.hours.slotDiffers"))).toBeInTheDocument()
    await user.click(switchOf("Sunday"))
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("rentals.schedule.hours.problem.slotRequired"))
    await user.click(screen.getByRole("radio", { name: i18n.t("rentals.schedule.hours.slotUnit", { count: 60 }) }))
    await user.click(saveButton())
    const plan = onSave.mock.calls[0][0] as BusinessHoursPlan
    expect(plan.groups).toEqual([{ days: ["Sunday"], openTime: "08:00", closeTime: "18:00" }])
    expect(plan.removals).toEqual([])
  })

  it("scopes to chosen resources and keeps every control locked while read-only", async () => {
    const user = userEvent.setup()
    const onSelectedRentalAssetIdsChange = vi.fn()
    const { props } = renderEditor({ assets: [asset("a"), asset("b")], selectedRentalAssetIds: ["a", "b"], onSelectedRentalAssetIdsChange })
    expect(screen.getByRole("radio", { name: i18n.t("rentals.schedule.hours.allResources") })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: i18n.t("rentals.schedule.hours.someResources") }))
    await user.click(screen.getByRole("checkbox", { name: "Sala b" }))
    expect(onSelectedRentalAssetIdsChange).toHaveBeenCalledWith(["a"])
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it("locks the editor when the plan is read-only", () => {
    renderEditor({ readOnly: true })
    expect(switchOf("Monday")).toHaveAttribute("aria-disabled", "true")
    expect(timeOf("Monday", "opens")).toBeDisabled()
    expect(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.copyToAll") })).toBeDisabled()
  })
})
