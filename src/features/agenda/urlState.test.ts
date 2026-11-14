import { describe, expect, it } from "vitest"
import { parseAgendaState, serializeAgendaState } from "./urlState"

const base = { visao: "dia", date: "2026-11-10", recursos: [], produto: null, pedido: null, tipo: null, livres: false, fechadas: true }

describe("staff agenda URL", () => {
  it("defaults to the tenant civil date and validates view, date and type", () => {
    expect(parseAgendaState(new URLSearchParams("visao=other&date=2026-02-30&tipo=other&recurso="), "2026-11-10")).toEqual(base)
  })
  it("serializes one stable value per key, omitting empty keys and preserving unrelated params", () => {
    const params = new URLSearchParams("visao=&produto=&other=keep")
    const state = parseAgendaState(params, "2026-11-10")
    const result = serializeAgendaState({ ...state, visao: "semana", recursos: ["a", "b"], tipo: "reserva" }, params)
    expect(result.toString()).toBe("visao=semana&other=keep&date=2026-11-10&recursos=a%2Cb&tipo=reserva")
  })
  it("round-trips recursos and the option flags", () => {
    const state = parseAgendaState(new URLSearchParams("recursos=a,b,a&livres=1&fechadas=0"), "2026-11-10")
    expect(state).toMatchObject({ recursos: ["a", "b"], livres: true, fechadas: false })
    const params = serializeAgendaState(state)
    expect(params.get("recursos")).toBe("a,b")
    expect(params.get("livres")).toBe("1")
    expect(params.get("fechadas")).toBe("0")
    expect(serializeAgendaState({ ...state, livres: false, fechadas: true }).has("fechadas")).toBe(false)
  })
  it("maps the legacy recurso param to recursos and drops it on write", () => {
    const params = new URLSearchParams("recurso=old-id&other=keep")
    const state = parseAgendaState(params, "2026-11-10")
    expect(state.recursos).toEqual(["old-id"])
    const result = serializeAgendaState(state, params)
    expect(result.has("recurso")).toBe(false)
    expect(result.get("recursos")).toBe("old-id")
    expect(result.get("other")).toBe("keep")
  })
  it("prefers recursos over the legacy param", () => {
    expect(parseAgendaState(new URLSearchParams("recurso=old&recursos=new"), "2026-11-10").recursos).toEqual(["new"])
  })
})
