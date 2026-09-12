import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"

describe("LayoutCanvasBoard pick labels", () => {
  it("keeps full names in aria-label and avoids character-wrapping classes", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q1",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            label: "Quadra de Tênis Coberta Q-1",
            xPercent: 8,
            yPercent: 10,
            widthPercent: 15,
            heightPercent: 18,
            zIndex: 1,
            available: true,
          },
        ]}
      />,
    )

    const tile = screen.getByRole("button", {
      name: "Quadra de Tênis Coberta Q-1",
    })
    expect(tile).toHaveAttribute("title", "Quadra de Tênis Coberta Q-1")
    expect(tile.className).toContain("min-w-0")
    expect(tile.className).toContain("overflow-hidden")

    const label = tile.querySelector("span")
    expect(label).not.toBeNull()
    expect(label?.className).toContain("break-normal")
    expect(label?.className).toContain("line-clamp-2")
    expect(label?.className).not.toContain("break-words")
    expect(label?.className).not.toContain("px-3")
  })
})
