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

describe("SchedulePolicyPanel", () => {
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
})
