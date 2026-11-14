import { civilDateParam } from "@/features/catalog/components/agenda/agendaLayout"

export const agendaTypes = ["reserva", "pedido", "manutencao", "bloqueio"] as const
export const agendaFilterKeys = ["produto", "pedido", "tipo"] as const
export type AgendaFilterKey = (typeof agendaFilterKeys)[number]
export type AgendaState = {
  visao: "dia" | "semana"
  date: string
  /** Selected resource ids; empty means every resource. */
  recursos: string[]
  produto: string | null
  pedido: string | null
  tipo: (typeof agendaTypes)[number] | null
  /** Only resources with free time in the range. URL: `livres=1`. */
  livres: boolean
  /** Show closed hours (default on). URL: `fechadas=0` when off. */
  fechadas: boolean
}

function parseIds(value: string | null) {
  return [...new Set((value ?? "").split(",").map((id) => id.trim()).filter(Boolean))]
}

export function parseAgendaState(params: URLSearchParams, today: string): AgendaState {
  const tipo = params.get("tipo")
  const recursos = parseIds(params.get("recursos"))
  // Legacy single `recurso` (a resource category id in old links): read as `recursos=[id]`.
  const legacy = params.get("recurso")?.trim()
  return {
    visao: params.get("visao") === "semana" ? "semana" : "dia",
    date: civilDateParam(params.get("date")) ?? today,
    recursos: recursos.length > 0 ? recursos : legacy ? [legacy] : [],
    produto: params.get("produto")?.trim() || null,
    pedido: params.get("pedido")?.trim() || null,
    tipo: agendaTypes.find((value) => value === tipo) ?? null,
    livres: params.get("livres") === "1",
    fechadas: params.get("fechadas") !== "0",
  }
}

export function serializeAgendaState(state: AgendaState, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current)
  params.set("visao", state.visao)
  params.set("date", state.date)
  params.delete("recurso")
  if (state.recursos.length > 0) params.set("recursos", state.recursos.join(","))
  else params.delete("recursos")
  for (const key of agendaFilterKeys) {
    const value = state[key]
    if (value) params.set(key, value)
    else params.delete(key)
  }
  if (state.livres) params.set("livres", "1")
  else params.delete("livres")
  if (state.fechadas) params.delete("fechadas")
  else params.set("fechadas", "0")
  return params
}
