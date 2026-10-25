import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"

const asset: AdminRentalAsset = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Quadra 1",
  isActive: true,
  requiresDeposit: true,
  schedulePolicy: "OpenHours",
  openTime: "08:00",
  closeTime: "22:00",
  allowedDurationMinutes: "60",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  type: "Location",
  totalQuantity: 1,
  queueEnabled: false,
}

function renderPanel(allowedDurationMinutes = "60") {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SchedulePolicyPanel
      assets={[{ ...asset, allowedDurationMinutes }]}
      busy={false}
      busyAction={null}
      readOnly={false}
      onSave={onSave}
      onSeedSlotGrid={vi.fn()}
    />,
  )
  return onSave
}

function renderSlotGridPanel(allowedDurationMinutes: string | null = null) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <SchedulePolicyPanel
      assets={[{
        ...asset,
        schedulePolicy: "SlotGrid",
        openTime: null,
        closeTime: null,
        allowedDurationMinutes,
      }]}
      busy={false}
      busyAction={null}
      readOnly={false}
      onSave={onSave}
      onSeedSlotGrid={vi.fn()}
    />,
  )
  return onSave
}

describe("SchedulePolicyPanel", () => {
  it("derives standard hours from the saved weekly grid and does not offer reseeding", async () => {
    const user = userEvent.setup()
    render(
      <SchedulePolicyPanel
        assets={[{
          ...asset,
          schedulePolicy: "SlotGrid",
          openTime: null,
          closeTime: null,
          allowedDurationMinutes: null,
        }]}
        templates={[{
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          rentalAssetId: asset.id,
          assetName: asset.name,
          dayOfWeek: "Monday",
          startTime: "09:00:00",
          endTime: "09:30:00",
          occupancyKindId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          occupancyKindLabel: "Open",
          label: null,
          isActive: true,
        }, {
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          rentalAssetId: asset.id,
          assetName: asset.name,
          dayOfWeek: "Sunday",
          startTime: "18:30:00",
          endTime: "19:00:00",
          occupancyKindId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          occupancyKindLabel: "Open",
          label: null,
          isActive: true,
        }]}
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onSeedSlotGrid={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", {
      name: i18n.t("rentals.schedule.seedTemplates"),
    })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", {
      name: new RegExp(i18n.t("rentals.schedule.policy.openHours")),
    }))

    expect(screen.getByLabelText(i18n.t("rentals.schedule.policy.openTime"))).toHaveValue("09:00")
    expect(screen.getByLabelText(i18n.t("rentals.schedule.policy.closeTime"))).toHaveValue("19:00")
    expect(screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes"))).toHaveValue("30")
  })

  it("hides reseeding while the all-week schedule is loading", () => {
    render(
      <SchedulePolicyPanel
        assets={[{
          ...asset,
          schedulePolicy: "SlotGrid",
          openTime: null,
          closeTime: null,
          allowedDurationMinutes: null,
        }]}
        loadingTemplates
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onSeedSlotGrid={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", {
      name: i18n.t("rentals.schedule.seedTemplates"),
    })).not.toBeInTheDocument()
  })

  it("saves a comma-separated duration list", async () => {
    const user = userEvent.setup()
    const onSave = renderPanel()
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.clear(input)
    await user.type(input, "30,60")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.policy.saveOpenHours"),
      }),
    )

    expect(onSave).toHaveBeenCalledWith({
      schedulePolicy: "OpenHours",
      openTime: "08:00",
      closeTime: "22:00",
      allowedDurationMinutes: "30,60",
    })
  })

  it.each(["00:00", "24:00"])("keeps every typed digit in the close time %s", async (closeTime) => {
    const user = userEvent.setup()
    renderPanel()
    const input = screen.getByLabelText(i18n.t("rentals.schedule.policy.closeTime"))

    await user.clear(input)
    await user.type(input, closeTime)

    expect(input).toHaveValue(closeTime)
  })

  it("keeps the full stored duration list in the field", () => {
    renderPanel("60,120,240")

    expect(
      screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes")),
    ).toHaveValue("60,120,240")
  })

  it("normalizes duration values before saving", async () => {
    const user = userEvent.setup()
    const onSave = renderPanel()
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.clear(input)
    await user.type(input, "240, 60,60")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.policy.saveOpenHours"),
      }),
    )

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ allowedDurationMinutes: "60,240" }),
    )
  })

  it("does not save an invalid duration list", async () => {
    const user = userEvent.setup()
    const onSave = renderPanel()
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.clear(input)
    await user.type(input, "30,nope")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.policy.saveOpenHours"),
      }),
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("rentals.schedule.policy.durationMinutesInvalid"),
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it("saves SlotGrid multi-slot durations", async () => {
    const user = userEvent.setup()
    const onSave = renderSlotGridPanel()
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.type(input, "30,60,90")
    await user.click(screen.getByRole("button", {
      name: i18n.t("rentals.schedule.policy.saveSlotGrid"),
    }))

    expect(onSave).toHaveBeenCalledWith({
      schedulePolicy: "SlotGrid",
      openTime: null,
      closeTime: null,
      allowedDurationMinutes: "30,60,90",
    })
  })

  it("saves blank SlotGrid multi-slot durations as null", async () => {
    const user = userEvent.setup()
    const onSave = renderSlotGridPanel("30,60,90")
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.clear(input)
    await user.click(screen.getByRole("button", {
      name: i18n.t("rentals.schedule.policy.saveSlotGrid"),
    }))

    expect(onSave).toHaveBeenCalledWith({
      schedulePolicy: "SlotGrid",
      openTime: null,
      closeTime: null,
      allowedDurationMinutes: null,
    })
  })

  it("does not save invalid SlotGrid multi-slot durations", async () => {
    const user = userEvent.setup()
    const onSave = renderSlotGridPanel()
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.type(input, "30,nope")
    await user.click(screen.getByRole("button", {
      name: i18n.t("rentals.schedule.policy.saveSlotGrid"),
    }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("rentals.schedule.policy.durationMinutesInvalid"),
    )
    expect(onSave).not.toHaveBeenCalled()
  })
})
