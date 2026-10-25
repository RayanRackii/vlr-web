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

  it("uses the same available color when a space is selected", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q1",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            label: "Quadra 1",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: true,
            disabled: false,
            selected: true,
          },
          {
            key: "q2",
            rentalAssetId: "22222222-2222-4222-8222-222222222222",
            label: "Quadra 2",
            xPercent: 50,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 2,
            available: true,
            disabled: false,
            selected: false,
          },
        ]}
      />,
    )

    const selected = screen.getByRole("button", { name: "Quadra 1" })
    const other = screen.getByRole("button", { name: "Quadra 2" })
    expect(selected.className).toContain("bg-emerald-100")
    expect(other.className).toContain("bg-emerald-100")
    expect(selected.className).not.toContain("bg-primary/20")
  })

  it("shows a taken explanation in the tile, not only in the title", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q2",
            rentalAssetId: "22222222-2222-4222-8222-222222222222",
            label: "Quadra 2",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: false,
            disabled: true,
            detail: "Horário já reservado.",
          },
        ]}
      />,
    )

    const tile = screen.getByRole("button", {
      name: "Quadra 2. Horário já reservado.",
    })
    expect(tile).toHaveAttribute("aria-disabled", "true")
    expect(tile).toHaveTextContent("Horário já reservado.")
    expect(tile.className).toContain("text-foreground")
  })

  it("keeps a footer label clear of the visual art", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q3",
            rentalAssetId: "33333333-3333-4333-8333-333333333333",
            label: "Quadra 3",
            footer: "Quadra 3 · Tênis",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: true,
          },
        ]}
      />,
    )

    const tile = screen.getByRole("button", { name: "Quadra 3" })
    expect(tile).toHaveTextContent("Quadra 3 · Tênis")
    expect(tile.querySelector(".sm\\:absolute.sm\\:bottom-0")).not.toBeNull()
  })

  it("puts focus and screen-reader order in visual reading order", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q6",
            rentalAssetId: "66666666-6666-4666-8666-666666666666",
            label: "Q-6",
            xPercent: 70,
            yPercent: 55,
            widthPercent: 20,
            heightPercent: 20,
            zIndex: 6,
            available: true,
          },
          {
            key: "q5",
            rentalAssetId: "55555555-5555-4555-8555-555555555555",
            label: "Q-5",
            xPercent: 8,
            yPercent: 55,
            widthPercent: 20,
            heightPercent: 20,
            zIndex: 1,
            available: true,
          },
          {
            key: "q1",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            label: "Q-1",
            xPercent: 8,
            yPercent: 8,
            widthPercent: 20,
            heightPercent: 20,
            zIndex: 4,
            available: true,
          },
          {
            key: "q10",
            rentalAssetId: "10101010-1010-4101-8101-101010101010",
            label: "Q-10",
            xPercent: 40,
            yPercent: 8,
            widthPercent: 20,
            heightPercent: 20,
            zIndex: 2,
            available: true,
          },
        ]}
      />,
    )

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Q-1", "Q-10", "Q-5", "Q-6"])
  })
})
