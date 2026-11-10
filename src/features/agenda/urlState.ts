import { civilDateParam } from "@/features/catalog/components/agenda/agendaLayout"

export const agendaTypes = ["reserva", "pedido", "manutencao", "bloqueio"] as const
export const agendaFilterKeys = ["recurso", "produto", "pedido", "tipo"] as const
export type AgendaFilterKey = (typeof agendaFilterKeys)[number]
export type AgendaState = {
  visao: "dia" | "semana"
  date: string
  recurso: string | null
  produto: string | null
  pedido: string | null
  tipo: (typeof agendaTypes)[number] | null
}

export function parseAgendaState(params: URLSearchParams, today: string): AgendaState {
  const tipo = params.get("tipo")
  return {
    visao: params.get("visao") === "semana" ? "semana" : "dia",
    date: civilDateParam(params.get("date")) ?? today,
    recurso: params.get("recurso")?.trim() || null,
    produto: params.get("produto")?.trim() || null,
    pedido: params.get("pedido")?.trim() || null,
    tipo: agendaTypes.find((value) => value === tipo) ?? null,
  }
}

export function serializeAgendaState(state: AgendaState, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current)
  params.set("visao", state.visao)
  params.set("date", state.date)
  for (const key of agendaFilterKeys) {
    const value = state[key]
    if (value) params.set(key, value)
    else params.delete(key)
  }
  return params
}
