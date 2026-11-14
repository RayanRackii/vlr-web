import { useQuery } from "@tanstack/react-query"
import { agendaOrderSelect, agendaQueries, type AgendaRange } from "./agendaQueries"

export type AgendaOption = { id: string; label: string }

const noOptions: AgendaOption[] = []

function toResult(query: { data: AgendaOption[] | undefined; isPending: boolean; isError: boolean }, enabled: boolean) {
  return {
    options: enabled ? (query.data ?? noOptions) : noOptions,
    loading: enabled && query.isPending,
    error: enabled && query.isError,
  }
}

export function useAgendaProductOptions(tenantId: string | null, enabled: boolean) {
  return toResult(useQuery({ ...agendaQueries.products(tenantId), enabled }), enabled)
}

/** Same request as the day/week labels (one `listCatalogOrders({ from, to })` per visible range). */
export function useAgendaOrderOptions(tenantId: string | null, range: AgendaRange, enabled: boolean) {
  return toResult(useQuery({ ...agendaQueries.orders(tenantId, range), select: agendaOrderSelect.options, enabled }), enabled)
}
