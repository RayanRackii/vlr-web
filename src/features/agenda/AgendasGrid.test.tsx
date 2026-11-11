import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { AgendaDayGrid } from "./AgendaDayGrid"
import type { AgendaBlock } from "./dayGridModel"

const selected: AgendaBlock = {
  key: "selected", resourceId: "r1", kind: "pedido", productId: "p1", productName: "Podcast",
  start: 540, end: 720, startInstant: "2026-11-10T12:00:00Z", endInstant: "2026-11-10T15:00:00Z",
  workStart: "2026-11-10T12:30:00Z", workEnd: "2026-11-10T14:30:00Z",
}
function setup(block = selected) {
  return render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter>
    <AgendaDayGrid loading={false} failedSources={[]} rows={[{ id: "r1", name: "Estúdio", blocks: [block,
      { key: "other", resourceId: "r1", kind: "reserva", start: 780, end: 840, customerName: "Ana" }] }]}
      start={360} end={1380} canReserve={false} canBlock={false} focusedProductId="p1" focusDate="2026-11-10" />
  </MemoryRouter></TenantTimeZoneContext.Provider>)
}

describe("product focus on the existing grid", () => {
  it("keeps other uses visible and dims them", () => {
    setup()
    expect(screen.getByRole("button", { name: /Reserva.*Ana/ })).toHaveClass("opacity-40")
    expect(screen.getByRole("button", { name: /Pedido.*Podcast/ })).not.toHaveClass("opacity-40")
  })
  it("draws prep and cleanup only from existing occupied and work intervals", () => {
    setup()
    expect(parseFloat(screen.getByLabelText("Preparo").style.width)).toBeCloseTo(16.6667, 3)
    expect(parseFloat(screen.getByLabelText("Limpeza").style.width)).toBeCloseTo(16.6667, 3)
  })
  it("omits pads when work duration is unavailable", () => {
    setup({ ...selected, workStart: null, workEnd: null })
    expect(screen.queryByLabelText("Preparo")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Limpeza")).not.toBeInTheDocument()
  })
})
