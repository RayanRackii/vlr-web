import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WeeklyTemplatesTab, type WeeklyGridCellPayload } from "./WeeklyTemplatesTab"
import { TemplateSheet } from "./TemplateSheet"
import i18n from "@/lib/i18n"
import type { AdminRentalAsset, DayOfWeekName, OccupancyKind, ScheduleTemplate } from "@/features/rentals/services/scheduleService"

const asset: AdminRentalAsset = {
  id: "room", assetId: "asset", name: "Sala 1", isActive: true, requiresDeposit: false,
  schedulePolicy: "SlotGrid", openTime: "08:00:00", closeTime: "14:00:00", allowedDurationMinutes: "60",
  unitId: "unit", type: "Location", totalQuantity: 1, queueEnabled: false, queueOpeningTime: null,
  categoryId: null, categoryName: null,
}
const kinds: OccupancyKind[] = [{ id: "lesson", key: "lesson", label: "Aula", isActive: true, isBookableByCustomer: false, blocksCapacity: true, sortOrder: 0 }]
const monday: ScheduleTemplate = {
  id: "t1", rentalAssetId: "room", assetName: "Sala 1", dayOfWeek: "Monday", startTime: "08:00:00", endTime: "09:00:00",
  occupancyKindId: "lesson", occupancyKindLabel: "Aula", label: null, isActive: true,
}

function Harness() {
  const [weekday, setWeekday] = useState<DayOfWeekName>("Monday")
  const [target, setTarget] = useState<WeeklyGridCellPayload | null>(null)
  return <WeeklyTemplatesTab
    assets={[asset]} selectedRentalAssetIds={[asset.id]} weekday={weekday}
    templates={weekday === "Monday" ? [monday] : []} scheduleTemplates={[monday]} loadingScheduleTemplates={false}
    kinds={kinds} loading={false} showSkeleton={false}
    busy={false} busyAction={null} busyTargetId={null} readOnly={false}
    onSelectedRentalAssetIdsChange={vi.fn()} onWeekdayChange={setWeekday}
    onCellClick={setTarget} onSaveBusinessHours={vi.fn().mockResolvedValue({ ok: true, errors: [] })}
    templateEditor={<TemplateSheet open={Boolean(target)} onOpenChange={() => setTarget(null)} editing={target?.template ?? null}
      assetName={target?.assetName} lockDayOfWeek defaults={target ? { dayOfWeek: target.dayOfWeek, startTime: target.startTime, endTime: target.endTime } : undefined}
      kinds={kinds} defaultKindId="lesson" busy={false} busyAction={null} readOnly={false} onSubmit={vi.fn().mockResolvedValue(false)} />}
  />
}

describe("weekly templates tab (business hours)", () => {
  beforeEach(async () => { await i18n.changeLanguage("pt-BR") })

  it("shows the editor first and a read-only preview below, without the old duplicate entry points", () => {
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const editor = screen.getByRole("region", { name: i18n.t("rentals.schedule.hours.title") })
    const preview = screen.getByRole("region", { name: i18n.t("rentals.schedule.hours.preview") })
    expect(editor.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const key of ["rentals.schedule.weekly.configureHours", "rentals.schedule.weeklyRule.apply", "rentals.schedule.weeklyRule.title", "rentals.schedule.policy.title", "rentals.schedule.seedTemplates"]) {
      expect(screen.queryByRole("button", { name: new RegExp(i18n.t(key)) })).not.toBeInTheDocument()
      expect(screen.queryByRole("region", { name: i18n.t(key) })).not.toBeInTheDocument()
    }
    for (const key of ["rentals.schedule.toolbar.prevWeekday", "rentals.schedule.toolbar.nextWeekday", "rentals.schedule.toolbar.today"]) {
      expect(screen.queryByRole("button", { name: i18n.t(key) })).not.toBeInTheDocument()
    }
  })

  it("changes the previewed weekday and opens a slot for editing in the template sheet", async () => {
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const user = userEvent.setup()
    const tuesday = screen.getByRole("button", { name: i18n.t("rentals.schedule.days.Tuesday") })
    await user.click(tuesday)
    expect(tuesday).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.days.Monday") }))
    const preview = screen.getByRole("region", { name: i18n.t("rentals.schedule.hours.preview") })
    const cell = within(preview).getAllByRole("button").find((button) => button.getAttribute("aria-label")?.includes("08:00"))!
    await user.click(cell)
    const sheet = screen.getByRole("region", { name: i18n.t("rentals.schedule.templates.saveEdit") })
    expect(sheet).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("collapses and expands the preview", async () => {
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const user = userEvent.setup()
    const toggle = screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.previewHide") })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    await user.click(toggle)
    expect(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.previewShow") })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("group", { name: i18n.t("rentals.schedule.templates.dayOfWeek") })).not.toBeInTheDocument()
  })

  it("starts with the preview collapsed on a phone-sized viewport", () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })) as typeof window.matchMedia
    try {
      render(<MemoryRouter><Harness /></MemoryRouter>)
      expect(screen.getByRole("button", { name: i18n.t("rentals.schedule.hours.previewShow") })).toHaveAttribute("aria-expanded", "false")
    } finally {
      window.matchMedia = original
    }
  })
})
