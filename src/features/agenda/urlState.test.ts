import { describe, expect, it } from "vitest"
import { parseAgendaState, serializeAgendaState } from "./urlState"

describe("staff agenda URL", () => {
  it("defaults to the tenant civil date and validates view, date and type", () => {
    expect(parseAgendaState(new URLSearchParams("visao=other&date=2026-02-30&tipo=other&recurso="), "2026-11-10"))
      .toEqual({ visao: "dia", date: "2026-11-10", recurso: null, produto: null, pedido: null, tipo: null })
  })
  it("serializes one stable value per key, omitting empty keys and preserving unrelated params", () => {
    const params = new URLSearchParams("visao=&recurso=old&recurso=duplicate&produto=&other=keep")
    const state = parseAgendaState(params, "2026-11-10")
    const result = serializeAgendaState({ ...state, visao: "semana", recurso: "category-id", tipo: "reserva" }, params)
    expect(result.toString()).toBe("visao=semana&recurso=category-id&other=keep&date=2026-11-10&tipo=reserva")
  })
})
