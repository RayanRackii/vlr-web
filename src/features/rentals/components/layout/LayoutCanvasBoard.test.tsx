import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import i18n from "@/lib/i18n"

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

  it("explains an unavailable tile on click instead of staying silent", () => {
    const onSelect = vi.fn()
    const onUnavailableSelect = vi.fn()
    render(
      <LayoutCanvasBoard
        mode="pick"
        onSelect={onSelect}
        onUnavailableSelect={onUnavailableSelect}
        items={[
          {
            key: "r1",
            rentalAssetId: "33333333-3333-4333-8333-333333333333",
            label: "Sala 1",
            xPercent: 4,
            yPercent: 4,
            widthPercent: 40,
            heightPercent: 40,
            zIndex: 1,
            available: false,
            disabled: true,
            detail: "Ocupado",
          },
        ]}
      />,
    )
    const tile = screen.getByRole("button", { name: "Sala 1. Ocupado" })
    fireEvent.click(tile)
    fireEvent.keyDown(tile, { key: "Enter" })
    expect(onSelect).not.toHaveBeenCalled()
    expect(onUnavailableSelect).toHaveBeenCalledTimes(2)
    expect(tile).toHaveAttribute("tabindex", "0")
  })
})

describe("LayoutCanvasBoard edit-mode touch targets", () => {
  const item = { key: "r1", rentalAssetId: "r1", label: "Sala A", xPercent: 10, yPercent: 10, widthPercent: 20, heightPercent: 20, zIndex: 1 }

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
    vi.restoreAllMocks()
  })

  it.each([
    ["pt-BR", "Mover bloco Sala A", "Redimensionar bloco Sala A", "Remover bloco Sala A", "Redimensionar mapa"],
    ["en", "Move block Sala A", "Resize block Sala A", "Remove block Sala A", "Resize map"],
    ["es", "Mover bloque Sala A", "Cambiar tamaño del bloque Sala A", "Eliminar bloque Sala A", "Cambiar tamaño del mapa"],
  ])("names and focuses the edit controls with 24px fine and 44px coarse targets (%s)", async (language, moveLabel, resizeLabel, removeLabel, canvasLabel) => {
    await i18n.changeLanguage(language)
    const user = userEvent.setup()
    render(<LayoutCanvasBoard mode="edit" items={[item]} onRemove={vi.fn()} onFrameResize={vi.fn()} />)

    const move = screen.getByRole("button", { name: moveLabel })
    expect(move).toHaveClass("min-w-6", "min-h-6", "coarse:min-w-11", "coarse:min-h-11")
    await user.tab()
    expect(move).toHaveFocus()

    for (const name of [resizeLabel, removeLabel]) {
      const controls = screen.getAllByRole("button", { name })
      expect(controls).toHaveLength(2)
      expect(controls[0]).toHaveClass("size-6", "coarse:hidden")
      expect(controls[1]).toHaveClass("size-11", "coarse:flex")
    }
    expect(screen.getByRole("button", { name: canvasLabel })).toHaveClass("size-6", "coarse:size-11")
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring")
    }
  })

  it("separates edit targets even when the block is shorter than a target", () => {
    const { container } = render(<LayoutCanvasBoard mode="edit" items={[{ ...item, heightPercent: 8 }]} onRemove={vi.fn()} />)
    const [fineRemove, coarseRemove] = screen.getAllByRole("button", { name: "Remover bloco Sala A" })
    const [fineResize, coarseResize] = screen.getAllByRole("button", { name: "Redimensionar bloco Sala A" })
    expect(fineRemove).toHaveClass("bottom-full")
    expect(coarseRemove).toHaveClass("bottom-full")
    expect(fineResize).toHaveClass("top-[max(100%,1.5rem)]")
    expect(coarseResize).toHaveClass("top-[max(100%,2.75rem)]")
    expect(container.querySelector(".w-full")).toHaveClass("overflow-visible")
    const tile = container.querySelector(".overflow-hidden")
    for (const control of screen.getAllByRole("button")) {
      expect(tile?.contains(control)).toBe(false)
    }
  })

  it("keeps move, resize and remove interactions separate", () => {
    const onMove = vi.fn()
    const onResize = vi.fn()
    const onRemove = vi.fn()
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 500 } as DOMRect)
    render(<LayoutCanvasBoard mode="edit" items={[item]} onMove={onMove} onResize={onResize} onRemove={onRemove} />)

    const pointer = (target: Element | Window, type: string, clientX: number, clientY: number) => {
      fireEvent(target, new MouseEvent(type, { bubbles: true, clientX, clientY }))
    }
    pointer(screen.getByRole("button", { name: "Mover bloco Sala A" }), "pointerdown", 150, 100)
    pointer(window, "pointermove", 200, 125)
    expect(onMove).toHaveBeenLastCalledWith("r1", 16, 16)
    expect(onResize).not.toHaveBeenCalled()
    pointer(window, "pointerup", 200, 125)

    for (const resize of screen.getAllByRole("button", { name: "Redimensionar bloco Sala A" })) {
      onMove.mockClear()
      pointer(resize, "pointerdown", 300, 150)
      pointer(window, "pointermove", 400, 200)
      expect(onResize).toHaveBeenLastCalledWith("r1", 30, 30)
      expect(onMove).not.toHaveBeenCalled()
      pointer(window, "pointerup", 400, 200)
    }
    onResize.mockClear()
    for (const remove of screen.getAllByRole("button", { name: "Remover bloco Sala A" })) {
      pointer(remove, "pointerdown", 300, 50)
      fireEvent.click(remove)
      pointer(window, "pointermove", 400, 200)
    }
    expect(onRemove).toHaveBeenNthCalledWith(1, "r1")
    expect(onRemove).toHaveBeenNthCalledWith(2, "r1")
    expect(onMove).not.toHaveBeenCalled()
    expect(onResize).not.toHaveBeenCalled()
  })

  it("keeps the fine-pointer remove button and resize handle on opposite sides, hidden on coarse pointers", () => {
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

    const removeButtons = screen.getAllByRole("button", { name: "Remover bloco Quadra 1" })
    const fineRemove = removeButtons.find((button) => button.className.includes("coarse:hidden"))
    expect(fineRemove).toBeDefined()
    expect(fineRemove?.className).toContain("left-0")
    expect(fineRemove?.className).toContain("bottom-full")
    expect(fineRemove?.className).toContain("coarse:hidden")

    const resizeHandles = document.querySelectorAll('[class*="cursor-se-resize"]')
    const fineResize = Array.from(resizeHandles).find((handle) => handle.className.includes("coarse:hidden"))
    expect(fineResize).toBeDefined()
    expect(fineResize?.className).toContain("right-0")
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

    const removeButtons = screen.getAllByRole("button", { name: "Remover bloco Quadra 1" })
    const coarseRemove = removeButtons.find((button) => button.className.includes("coarse:flex"))
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
    const coarseResize = Array.from(resizeHandles).find((handle) => handle.className.includes("coarse:flex"))
    expect(coarseResize).toBeDefined()
    expect(coarseResize?.className).toContain("size-11")
    expect(coarseResize?.className).toContain("right-0")
    expect(coarseResize?.className).toContain("coarse:flex")
    expect(tile?.contains(coarseResize as Node)).toBe(false)

    // Opposite sides of the tile box: one is pinned above it, the other below.
    expect(coarseRemove?.className).toContain("bottom-full")
    expect(coarseResize?.className).toContain("top-[max(100%,2.75rem)]")
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
