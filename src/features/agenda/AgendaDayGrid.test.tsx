import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { AgendaDayGrid } from "./AgendaDayGrid"
import type { AgendaBlock, AgendaRow } from "./dayGridModel"

const block = (patch: Partial<AgendaBlock>): AgendaBlock => ({ key: "b", resourceId: "r1", kind: "pedido", start: 540, end: 660, orderId: "o1", displayNumber: "#30", customerName: "E2E Customer", productName: "Corte a laser", ...patch })
const row = (patch: Partial<AgendaRow> = {}): AgendaRow => ({ id: "r1", name: "Cortadora", resourceType: "Good", categoryName: "QA goods", open: 480, close: 1200, blocks: [], ...patch })

function setup(rows: AgendaRow[], props: Partial<React.ComponentProps<typeof AgendaDayGrid>> = {}) {
  const onCreateReservation = vi.fn()
  render(
    <TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter>
      <AgendaDayGrid loading={false} failedSources={[]} rows={rows} start={480} end={1200} canReserve canBlock={false} onCreateReservation={onCreateReservation} {...props} />
    </MemoryRouter></TenantTimeZoneContext.Provider>,
  )
  return { onCreateReservation }
}
const section = (name: string) => screen.getByRole("region", { name })

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("agenda day grid (timeline)", () => {
  it("labels one hour per column from the axis start and shows resource kind and category", () => {
    setup([row()])
    expect(screen.getByText("08:00")).toBeInTheDocument()
    expect(screen.getByText("19:00")).toBeInTheDocument()
    expect(screen.queryByText("20:00")).not.toBeInTheDocument()
    expect(screen.queryByText("07:00")).not.toBeInTheDocument()
    expect(screen.getByText("Equipamento · QA goods")).toBeInTheDocument()
  })

  it("renders title, then time and product, and positions the block on the axis", () => {
    setup([row({ blocks: [block({ start: 480, end: 840 })] })])
    const item = within(section("Cortadora")).getByRole("button", { pressed: false, name: /Pedido 08:00 14:00/ })
    expect(item).toHaveTextContent("Pedido #30 · E2E Customer")
    expect(item).toHaveTextContent("08:00 – 14:00 · Corte a laser")
    expect(item.style.left).toBe("0%")
    expect(parseFloat(item.style.width)).toBeCloseTo(50, 3)
  })

  it("clips a block that spans the day to the axis and shows Dia inteiro with a continues marker", () => {
    setup([row({ blocks: [block({ start: 0, end: 1440, key: "long" })] })])
    const item = within(section("Cortadora")).getByRole("button", { name: /Pedido/ })
    expect(item).toHaveTextContent("Dia inteiro · Corte a laser")
    expect(item).toHaveAttribute("data-clipped", "true")
    // Text clears both edge chevrons.
    expect(item).toHaveClass("pl-6", "pr-6")
    expect(item.style.left).toBe("0%")
    expect(item.style.width).toBe("100%")
    // The axis was not widened to fit the block.
    expect(screen.queryByText("00:00")).not.toBeInTheDocument()
  })

  it("keeps the real times on a block clipped at one edge and drops one fully outside the axis", () => {
    setup([row({ blocks: [block({ start: 420, end: 600, key: "edge" }), block({ start: 0, end: 300, key: "early" })] })])
    expect(within(section("Cortadora")).getAllByRole("button", { name: /Pedido/ })).toHaveLength(1)
    expect(screen.getByText(/^07:00 – 10:00/)).toBeInTheDocument()
    expect(screen.getByText("1 fora do horário")).toBeInTheDocument()
  })

  it("stacks overlapping blocks in lanes, grows the row and never leaves it", () => {
    setup([row({ blocks: [block({ key: "a", start: 540, end: 720 }), block({ key: "b", start: 600, end: 780, displayNumber: "#31" })] })])
    const [first, second] = within(section("Cortadora")).getAllByRole("button", { name: /Pedido/ })
    expect(first.style.top).toBe("0.5rem")
    expect(second.style.top).toBe("4rem")
    expect(first.parentElement?.style.minHeight).toBe("7.75rem")
  })

  it("tints the current hour of every row when a time of today is given", () => {
    setup([row(), row({ id: "r2", name: "Outra" })], { nowMinutes: 600 })
    const tints = screen.getAllByTestId("now-hour")
    expect(tints).toHaveLength(2)
    expect(parseFloat(tints[0].style.left)).toBeCloseTo((120 / 720) * 100, 3)
  })

  it("has no tint on another day", () => {
    setup([row()], { nowMinutes: null })
    expect(screen.queryByTestId("now-hour")).not.toBeInTheDocument()
  })

  it("has no tint when now is outside the shown hours", () => {
    setup([row()], { nowMinutes: 1300 })
    expect(screen.queryByTestId("now-hour")).not.toBeInTheDocument()
  })
})

describe("polish", () => {
  it("makes a full-day block span the whole track, with a visible tinted fill and the 3px kind border", () => {
    setup([row({ blocks: [block({ start: 0, end: 1440, key: "long" })] })])
    const item = within(section("Cortadora")).getByRole("button", { name: /Pedido/ })
    expect(parseFloat(item.style.left)).toBe(0)
    expect(parseFloat(item.style.width)).toBeCloseTo(100, 3)
    expect(item.className).toContain("color-mix")
    expect(item).toHaveClass("border-l-[3px]", "border-l-primary")
  })

  it("spans a block clipped at one edge from its visible start to the axis edge", () => {
    setup([row({ blocks: [block({ start: 900, end: 1500, key: "late" })] })])
    const item = within(section("Cortadora")).getByRole("button", { name: /Pedido/ })
    expect(parseFloat(item.style.left)).toBeCloseTo(((900 - 480) / 720) * 100, 3)
    expect(parseFloat(item.style.width)).toBeCloseTo(((1200 - 900) / 720) * 100, 3)
  })

  it("lanes by the clipped range: a block hidden before the axis does not push another down", () => {
    setup([row({ blocks: [block({ key: "early", start: 0, end: 600 }), block({ key: "in", start: 540, end: 700, displayNumber: "#9" })] })])
    const [first, second] = within(section("Cortadora")).getAllByRole("button", { name: /Pedido/ })
    expect([first.style.top, second.style.top]).toEqual(["0.5rem", "4rem"])
  })

  it("uses a wider resource column from lg and lets the name wrap", () => {
    setup([row({ name: "Cortadora Laser Gama" })])
    expect(section("Cortadora Laser Gama")).toHaveClass("lg:grid-cols-[16rem_minmax(0,1fr)]")
    expect(screen.getByRole("heading", { name: "Cortadora Laser Gama" })).not.toHaveClass("truncate")
  })
})

describe("24 hour mode", () => {
  it("keeps the outside-hours hint in the resource cell, off the track", () => {
    setup([row({ blocks: [block({ start: 0, end: 300 })] })])
    const hint = screen.getByText("1 fora do horário")
    expect(within(section("Cortadora")).getByRole("heading", { name: "Cortadora" }).parentElement).toContainElement(hint)
  })

  it("hints that the grid scrolls and keeps the resource column sticky", () => {
    setup([row()], { start: 0, end: 1440 })
    expect(screen.getByText("Role para ver mais horas")).toBeInTheDocument()
    expect(screen.getByTestId("scroll-fade")).toBeInTheDocument()
    expect(within(section("Cortadora")).getByRole("heading", { name: "Cortadora" }).parentElement?.parentElement).toHaveClass("sticky", "left-0")
  })

  it("shows no scroll hint for business hours", () => {
    setup([row()])
    expect(screen.queryByText("Role para ver mais horas")).not.toBeInTheDocument()
    expect(screen.queryByTestId("scroll-fade")).not.toBeInTheDocument()
  })
})

describe("empty slots", () => {
  it("shows Disponível para reserva on an empty row and opens the create flow with the resource and first slot", async () => {
    const { onCreateReservation } = setup([row()])
    await userEvent.click(screen.getByText("Disponível para reserva"))
    expect(onCreateReservation).toHaveBeenCalledWith("r1", 480)
  })

  it("maps the click position to the slot hour", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 68, right: 1000, bottom: 68, x: 0, y: 0, toJSON: () => ({}) })
    const { onCreateReservation } = setup([row({ blocks: [block({ start: 480, end: 540 })] })])
    await userEvent.pointer({ keys: "[MouseLeft]", target: screen.getByRole("button", { name: "Reservar Cortadora" }), coords: { clientX: 500 } })
    expect(onCreateReservation).toHaveBeenCalledWith("r1", 840)
  })

  it("does nothing, and offers no button, without reservation permission", () => {
    setup([row()], { canReserve: false })
    expect(screen.getByText("Disponível para reserva")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reservar Cortadora" })).not.toBeInTheDocument()
  })

  it("keeps Bloquear período reachable from the row menu", async () => {
    setup([row()], { canBlock: true })
    await userEvent.click(screen.getByRole("button", { name: "Ações de Cortadora" }))
    expect(await screen.findByRole("menuitem", { name: "Bloquear período" })).toHaveAttribute("href", "/configuracoes/agenda")
  })
})

describe("block period from the row menu", () => {
  it("opens the block flow for the row's resource and opening time", async () => {
    const onBlockPeriod = vi.fn()
    setup([row()], { canBlock: true, onBlockPeriod })
    await userEvent.click(screen.getByRole("button", { name: "Ações de Cortadora" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Bloquear período" }))
    expect(onBlockPeriod).toHaveBeenCalledWith("r1", 480)
  })
})

describe("below md", () => {
  it("lists each resource as a card with its blocks, or Disponível para reserva", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const { onCreateReservation } = setup([row({ blocks: [block({})] }), row({ id: "r2", name: "Kit Som" })])
    expect(document.querySelector("[data-layout='list']")).not.toBeNull()
    const card = section("Cortadora")
    expect(within(card).getByText("09:00 – 11:00")).toBeInTheDocument()
    expect(within(section("Kit Som")).queryByText("Dia inteiro")).not.toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Pedido/ })).toHaveTextContent("Pedido #30 · E2E Customer")
    await userEvent.click(within(section("Kit Som")).getByRole("button", { name: "Reservar Kit Som" }))
    expect(onCreateReservation).toHaveBeenCalledWith("r2", 480)
  })

  it("shows Dia inteiro instead of 00:00 – 23:59 for a block covering the visible day", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    setup([row({ blocks: [block({ start: 0, end: 1440 })] })])
    expect(within(section("Cortadora")).getByText("Dia inteiro")).toBeInTheDocument()
    expect(screen.queryByText(/00:00/)).not.toBeInTheDocument()
  })
})
