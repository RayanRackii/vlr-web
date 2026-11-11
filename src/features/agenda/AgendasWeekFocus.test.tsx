import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { AgendaWeek } from "./AgendaWeek"

it("separates selected-product orders from dimmed other orders in the same weekly cell", () => {
  const cell = { date: "2026-11-10", counts: { pedido: 2, reserva: 0, manutencao: 0, bloqueio: 0 } }
  render(<AgendaWeek loading={false} failedSources={[]} days={[cell.date]} rows={[{ id: "r1", name: "Estúdio", cells: [cell] }]}
    focusedRows={[{ id: "r1", name: "Estúdio", cells: [{ ...cell, counts: { ...cell.counts, pedido: 1 } }] }]}
    today={cell.date} onOpenDay={() => {}} />)
  expect(screen.getByLabelText("Pedidos do produto: 1")).toHaveTextContent("1")
  expect(screen.getByLabelText("Outros usos · Pedido: 1")).toHaveClass("opacity-40")
  expect(screen.getByLabelText("Outros usos · Pedido: 1")).toHaveTextContent("1")
})
