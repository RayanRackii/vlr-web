import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TemplateSheet } from "./TemplateSheet"
import { WeeklyRuleSheet } from "./WeeklyRuleSheet"
import i18n from "@/lib/i18n"
import type { OccupancyKind } from "@/features/rentals/services/scheduleService"

const kinds: OccupancyKind[] = [
  { id: "lesson", key: "lesson", label: "Aula", isActive: true, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 0 },
  { id: "maintenance", key: "maintenance", label: "Manutenção", isActive: true, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 1 },
]
const shared = { open: true, onOpenChange: vi.fn(), kinds, defaultKindId: "lesson", busy: false, busyAction: null, readOnly: false }

describe("weekly inline editors", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
  })

  it("renders the rule inline and submits selected day and occupancy chips", async () => {
    const onApply = vi.fn().mockResolvedValue(false)
    const { container } = render(<WeeklyRuleSheet {...shared} selectedRentalAssetIds={["room"]} weekday="Monday" onApply={onApply} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const editor = screen.getByRole("region", { name: i18n.t("rentals.schedule.weeklyRule.title") })
    expect(container).toContainElement(editor)
    const user = userEvent.setup()
    await user.click(within(editor).getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") }))
    await user.click(within(editor).getByRole("button", { name: "Manutenção" }))
    await user.click(within(editor).getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.apply") }))
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ daysOfWeek: ["Monday", "Tuesday"], occupancyKindId: "maintenance" }))
    expect(editor.querySelector('[role="combobox"], .lucide-chevron-down, .lucide-chevron-up')).toBeNull()
    expect(shared.onOpenChange).not.toHaveBeenCalled()
  })
  it("renders the template inline and changes weekday and kind through chips", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    const { container } = render(<TemplateSheet {...shared} editing={null} onSubmit={onSubmit} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const editor = screen.getByRole("region", { name: i18n.t("rentals.schedule.templates.saveCreate") })
    expect(container).toContainElement(editor)
    const user = userEvent.setup()
    await user.click(within(editor).getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") }))
    await user.click(within(editor).getByRole("button", { name: "Manutenção" }))
    await user.click(within(editor.querySelector("footer")!).getByRole("button", { name: i18n.t("rentals.schedule.templates.saveCreate") }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dayOfWeek: "Tuesday", occupancyKindId: "maintenance" }))
    expect(editor.querySelector('[role="combobox"], .lucide-chevron-down, .lucide-chevron-up')).toBeNull()
    expect(shared.onOpenChange).not.toHaveBeenCalled()
  })

  it.each(["busy", "readOnly"] as const)("preserves %s locks in both inline editors", (lock) => {
    render(<><WeeklyRuleSheet {...shared} {...{ [lock]: true }} selectedRentalAssetIds={["room"]} weekday="Monday" onApply={vi.fn()} /><TemplateSheet {...shared} {...{ [lock]: true }} editing={null} onSubmit={vi.fn()} /></>)
    for (const editor of screen.getAllByRole("region")) {
      expect(within(editor).getByRole("button", { name: i18n.t("rentals.schedule.days.Monday") })).toBeDisabled()
      expect(within(editor).getByRole("button", { name: "Manutenção" })).toBeDisabled()
      expect(within(editor.querySelector("footer")!).getAllByRole("button").at(-1)).toBeDisabled()
    }
  })

  it("keeps rule validation, cancel, and collapse available", async () => {
    const onApply = vi.fn()
    render(<WeeklyRuleSheet {...shared} selectedRentalAssetIds={["room"]} weekday="Monday" onApply={onApply} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.days.Monday") }))
    expect(screen.getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.apply") })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(shared.onOpenChange).toHaveBeenCalledWith(false)
    expect(onApply).not.toHaveBeenCalled()
  })

  it("preserves editing fields, inactive kind, delete, and successful close", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const onDelete = vi.fn()
    render(<TemplateSheet {...shared} kinds={[{ ...kinds[0], isActive: false }, kinds[1]]} editing={{
      id: "template", rentalAssetId: "room", assetName: "Sala 1", dayOfWeek: "Friday", startTime: "10:00:00", endTime: "11:00:00", occupancyKindId: "lesson", occupancyKindLabel: "Aula", label: "Horário padrão", isActive: false,
    }} onSubmit={onSubmit} onDelete={onDelete} />)
    expect(screen.getByRole("button", { name: "Aula" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("checkbox", { name: i18n.t("rentals.schedule.active") })).not.toBeChecked()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: i18n.t("common.delete") }))
    expect(onDelete).toHaveBeenCalledOnce()
    await user.click(within(screen.getByRole("region").querySelector("footer")!).getByRole("button", { name: i18n.t("rentals.schedule.templates.saveEdit") }))
    expect(onSubmit).toHaveBeenCalledWith({ dayOfWeek: "Friday", startTime: "10:00", endTime: "11:00", occupancyKindId: "lesson", label: "Horário padrão", isActive: false })
    expect(shared.onOpenChange).toHaveBeenCalledWith(false)
  })

})
