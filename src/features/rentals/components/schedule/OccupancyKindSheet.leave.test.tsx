import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { OccupancyKindSheet } from "@/features/rentals/components/schedule/OccupancyKindSheet"
import i18n from "@/lib/i18n"

describe("OccupancyKindSheet leave", () => {
  it("treats a label change as dirty and asks on collapse, while cancel discards", async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const onRequestClose = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <OccupancyKindSheet
        open
        onOpenChange={onOpenChange}
        onDirtyChange={onDirtyChange}
        onRequestClose={onRequestClose}
        editing={null}
        busy={false}
        readOnly={false}
        onSubmit={async () => true}
      />,
    )

    await user.type(
      screen.getByPlaceholderText(i18n.t("rentals.schedule.kinds.placeholders.label")),
      "Aula",
    )
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))

    await user.click(screen.getByRole("button", {
      name: i18n.t("rentals.schedule.kinds.saveCreate"),
      expanded: true,
    }))
    expect(onRequestClose).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRequestClose).toHaveBeenCalledOnce()
  })
})
