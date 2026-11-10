import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  it("treats a duration edit and a mode change as dirty", async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SchedulePolicyPanel
        assets={[{ ...asset, schedulePolicy: "SlotGrid", openTime: null, closeTime: null, allowedDurationMinutes: "60" }]}
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={vi.fn()}
        onSeedSlotGrid={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    )
    const duration = screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes"))
    fireEvent.change(duration, { target: { value: "60,90" } })
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))
    fireEvent.change(duration, { target: { value: "60" } })
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
    await user.click(screen.getByRole("button", { name: new RegExp(`^${i18n.t("rentals.schedule.policy.openHours")}`) }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))
  })

  it("does not stay dirty when a saved duration only differs by spaces", async () => {
    const onDirtyChange = vi.fn()
    render(
      <SchedulePolicyPanel
        assets={[{ ...asset, schedulePolicy: "SlotGrid", openTime: null, closeTime: null, allowedDurationMinutes: "60,90" }]}
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={vi.fn()}
        onSeedSlotGrid={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    )
    fireEvent.change(screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes")), {
      target: { value: "60, 90" },
    })
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalled())
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
  })

  it("keeps a dirty duration when the weekly templates refresh", async () => {
    const onDirtyChange = vi.fn()
    const props = {
      assets: [{ ...asset, schedulePolicy: "SlotGrid" as const, openTime: null, closeTime: null, allowedDurationMinutes: "60" }],
      busy: false,
      busyAction: null,
      readOnly: false,
      onSave: vi.fn(),
      onSeedSlotGrid: vi.fn(),
      onDirtyChange,
      templates: [{
        id: "11111111-1111-4111-8111-111111111111",
        rentalAssetId: asset.id,
        assetName: asset.name,
        dayOfWeek: "Monday",
        startTime: "08:00:00",
        endTime: "09:00:00",
        occupancyKindId: "22222222-2222-4222-8222-222222222222",
        occupancyKindLabel: "Aula",
        label: null,
        isActive: true,
      }],
    }
    const view = render(<SchedulePolicyPanel {...props} />)
    const duration = screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes"))
    fireEvent.change(duration, { target: { value: "90" } })
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))
    view.rerender(
      <SchedulePolicyPanel
        {...props}
        templates={[{ ...props.templates[0], id: "33333333-3333-4333-8333-333333333333", endTime: "10:00:00" }]}
      />,
    )
    expect(screen.getByLabelText(i18n.t("rentals.schedule.policy.durationMinutes"))).toHaveValue("90")
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

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

  it("saves duration values as typed, without deduping or reordering", async () => {
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
      expect.objectContaining({ allowedDurationMinutes: "240,60,60" }),
    )
  })

  it("shows the API's 400 message inline under the field when the save is rejected", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(
      new Error("AllowedDurationMinutes must not exceed the open/close window."),
    )
    render(
      <SchedulePolicyPanel
        assets={[asset]}
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={onSave}
        onSeedSlotGrid={vi.fn()}
      />,
    )
    const input = screen.getByLabelText(
      i18n.t("rentals.schedule.policy.durationMinutes"),
    )

    await user.clear(input)
    await user.type(input, "600")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.policy.saveOpenHours"),
      }),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AllowedDurationMinutes must not exceed the open/close window.",
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
    expect(screen.getByRole("button", {
      name: i18n.t("rentals.schedule.policy.saveSlotGrid"),
    })).toBeDisabled()

    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("rentals.schedule.policy.durationMinutesInvalid"),
    )
    expect(onSave).not.toHaveBeenCalled()
  })
})
