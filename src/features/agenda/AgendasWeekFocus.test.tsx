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

it("tints only the column of today", () => {
  const cell = (date: string) => ({ date, counts: { pedido: 0, reserva: 0, manutencao: 0, bloqueio: 0 } })
  render(<AgendaWeek loading={false} failedSources={[]} days={["2026-11-09", "2026-11-10"]} rows={[{ id: "r1", name: "Estúdio", cells: [cell("2026-11-09"), cell("2026-11-10")] }]}
    today="2026-11-10" onOpenDay={() => {}} />)
  expect(screen.getByRole("button", { name: /2026-11-10/ })).toHaveClass("bg-muted/60")
  expect(screen.getByRole("button", { name: /2026-11-09/ })).not.toHaveClass("bg-muted/60")
})
