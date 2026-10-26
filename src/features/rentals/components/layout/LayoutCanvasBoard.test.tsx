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

  it("reads as taken when a resource has no free window today, but stays clickable", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q7",
            rentalAssetId: "77777777-7777-4777-8777-777777777777",
            label: "Quadra 7",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: false,
          },
        ]}
      />,
    )

    const tile = screen.getByRole("button", { name: "Quadra 7" })
    expect(tile.className).not.toContain("bg-emerald-100")
    expect(tile.className).toContain("bg-muted")
    expect(tile).not.toHaveAttribute("aria-disabled")
    expect(tile).toHaveAttribute("tabIndex", "0")
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

  it("keeps the reason single-line with the full text in a title, clear of a footer below it", () => {
    render(
      <LayoutCanvasBoard
        mode="pick"
        items={[
          {
            key: "q4",
            rentalAssetId: "44444444-4444-4444-8444-444444444444",
            label: "Quadra 4",
            footer: "Quadra 4 · R$ 30,00/dia",
            detail: "Sua reserva · 2 de 3 unidades. Para mais unidades, cancele e reserve de novo.",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: false,
            disabled: true,
            ownReservation: true,
          },
        ]}
      />,
    )

    const reason = screen.getByTitle(
      "Sua reserva · 2 de 3 unidades. Para mais unidades, cancele e reserve de novo.",
    )
    expect(reason.className).toContain("truncate")
    expect(reason.className).not.toContain("line-clamp-2")

    const tile = reason.closest('[role="button"]')
    expect(tile?.className).toContain("sm:pb-6")
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

describe("LayoutCanvasBoard edit-mode touch targets", () => {
  it("keeps the fine-pointer remove button and resize handle on opposite corners, hidden on coarse pointers", () => {
    render(
      <LayoutCanvasBoard
        mode="edit"
        items={[
          {
            key: "q1",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            label: "Quadra 1",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 10,
            zIndex: 1,
          },
        ]}
        onRemove={() => {}}
      />,
    )

    const removeButtons = screen.getAllByRole("button", { name: "remove" })
    const fineRemove = removeButtons.find((button) => button.className.includes("top-0.5"))
    expect(fineRemove).toBeDefined()
    expect(fineRemove?.className).toContain("right-0.5")
    expect(fineRemove?.className).toContain("coarse:hidden")

    const resizeHandles = document.querySelectorAll('[class*="cursor-se-resize"]')
    const fineResize = Array.from(resizeHandles).find((handle) => handle.className.includes("bottom-0.5"))
    expect(fineResize).toBeDefined()
    expect(fineResize?.className).toContain("right-0.5")
    expect(fineResize?.className).toContain("coarse:hidden")
  })

  it("places the coarse 44px remove and resize targets outside the clipped tile, on opposite sides", () => {
    render(
      <LayoutCanvasBoard
        mode="edit"
        items={[
          {
            key: "q1",
            rentalAssetId: "11111111-1111-4111-8111-111111111111",
            label: "Quadra 1",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 10,
            heightPercent: 6,
            zIndex: 1,
          },
        ]}
        onRemove={() => {}}
      />,
    )

    const removeButtons = screen.getAllByRole("button", { name: "remove" })
    const coarseRemove = removeButtons.find((button) => button.className.includes("bottom-full"))
    expect(coarseRemove).toBeDefined()
    expect(coarseRemove?.className).toContain("size-11")
    expect(coarseRemove?.className).toContain("left-0")
    expect(coarseRemove?.className).toContain("coarse:flex")
    // Sibling of the clipped tile, not a child inside it — overflow-hidden on
    // the tile can't clip a control it never contains.
    expect(coarseRemove?.parentElement?.contains).toBeDefined()
    const tile = coarseRemove?.parentElement?.querySelector(".overflow-hidden")
    expect(tile?.contains(coarseRemove as Node)).toBe(false)

    const resizeHandles = document.querySelectorAll('[class*="cursor-se-resize"]')
    const coarseResize = Array.from(resizeHandles).find((handle) => handle.className.includes("top-full"))
    expect(coarseResize).toBeDefined()
    expect(coarseResize?.className).toContain("size-11")
    expect(coarseResize?.className).toContain("right-0")
    expect(coarseResize?.className).toContain("coarse:flex")
    expect(tile?.contains(coarseResize as Node)).toBe(false)

    // Opposite sides of the tile box: one is pinned above it, the other below.
    expect(coarseRemove?.className).toContain("bottom-full")
    expect(coarseResize?.className).toContain("top-full")
  })
})

describe("LayoutCanvasBoard resize handles", () => {
  it("paints handles with a solid token (var() colors drop /opacity) and keeps a 44px coarse target", () => {
    const { container } = render(
      <LayoutCanvasBoard
        mode="edit"
        onResize={() => {}}
        items={[{ key: "r1", rentalAssetId: "r1", label: "Recurso", xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 20, zIndex: 1, available: true }]}
      />,
    )
    const handles = Array.from(container.querySelectorAll<HTMLElement>('[class*="cursor-se-resize"]'))
    expect(handles.length).toBeGreaterThan(0)
    for (const h of handles) expect(h.className).not.toMatch(/bg-primary\//)
    expect(handles.some((h) => h.className.includes("size-11"))).toBe(true)
  })
})
