import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WeeklyTemplatesTab, type WeeklyGridCellPayload } from "./WeeklyTemplatesTab"
import { TemplateSheet } from "./TemplateSheet"
import i18n from "@/lib/i18n"
import type { AdminRentalAsset, DayOfWeekName, OccupancyKind } from "@/features/rentals/services/scheduleService"

const asset: AdminRentalAsset = {
  id: "room", assetId: "asset", name: "Sala 1", isActive: true, requiresDeposit: false,
  schedulePolicy: "SlotGrid", openTime: "08:00:00", closeTime: "14:00:00", allowedDurationMinutes: "60",
  unitId: "unit", type: "Location", totalQuantity: 1, queueEnabled: false, queueOpeningTime: null,
  categoryId: null, categoryName: null,
}
const kinds: OccupancyKind[] = [{ id: "lesson", key: "lesson", label: "Aula", isActive: true, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 0 }]

function WeeklyHarness() {
  const [weekday, setWeekday] = useState<DayOfWeekName>("Monday")
  const [target, setTarget] = useState<WeeklyGridCellPayload | null>(null)
  return <WeeklyTemplatesTab
    assets={[asset]} selectedRentalAssetIds={[asset.id]} weekday={weekday}
    templates={[]} scheduleTemplates={[]} loadingScheduleTemplates={false}
    kinds={kinds} defaultKindId="lesson" loading={false} showSkeleton={false}
    busy={false} busyAction={null} busyTargetId={null} readOnly={false}
    onSelectedRentalAssetIdsChange={vi.fn()} onWeekdayChange={setWeekday}
    onCellClick={setTarget} onSeedSelected={vi.fn()} onSavePolicy={vi.fn()}
    onApplyWeeklyRule={vi.fn().mockResolvedValue(false)}
    templateEditor={<TemplateSheet open={Boolean(target)} onOpenChange={() => setTarget(null)} editing={null}
      assetName={target?.assetName} lockDayOfWeek defaults={target ? { dayOfWeek: target.dayOfWeek, startTime: target.startTime, endTime: target.endTime } : undefined}
      kinds={kinds} defaultKindId="lesson" busy={false} busyAction={null} readOnly={false} onSubmit={vi.fn().mockResolvedValue(false)} />}
  />
}

describe("weekly schedule modules", () => {
  beforeEach(async () => { await i18n.changeLanguage("pt-BR") })

  it("changes weekday with toolbar chips, opens both editors below the grid, and keeps hours inline", async () => {
    const { container } = render(<MemoryRouter><WeeklyHarness /></MemoryRouter>)
    const user = userEvent.setup()
    const tuesday = screen.getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") })
    await user.click(tuesday)
    expect(tuesday).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText(i18n.t("rentals.schedule.weeklyBanner", { day: i18n.t("rentals.schedule.days.Tuesday") }))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.apply") }))
    const rule = screen.getByRole("region", { name: i18n.t("rentals.schedule.weeklyRule.title") })
    expect(within(rule).getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") })).toHaveAttribute("aria-pressed", "false")
    const cell = screen.getAllByRole("button").find((button) => button.getAttribute("aria-label")?.includes("08:00"))!
    await user.click(cell)
    const template = screen.getByRole("region", { name: i18n.t("rentals.schedule.templates.saveCreate") })
    expect(cell.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cell.compareDocumentPosition(template) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(template).getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") })).toBeDisabled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-chevron-down, .lucide-chevron-up, [role="combobox"]')).toBeNull()
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.weekly.configureHours") }))
    const hours = screen.getByRole("region", { name: i18n.t("rentals.schedule.policy.title") })
    expect(within(hours).getByRole("button", { name: new RegExp(`^${i18n.t("rentals.schedule.policy.slotGrid")}`) })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
