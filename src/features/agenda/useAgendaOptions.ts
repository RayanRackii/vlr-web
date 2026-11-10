import { useEffect, useState } from "react"
import { listRentalAssetCategories } from "@/features/rentals/services/rentalResourcesService"
import { listCatalogOrders, listCatalogProducts } from "@/features/catalog/services/catalogService"

export type AgendaOption = { id: string; label: string }
export const agendaOptionLoaders = {
  recurso: async () => (await listRentalAssetCategories()).map(({ id, name }) => ({ id, label: name })),
  produto: async () => (await listCatalogProducts()).map(({ id, name }) => ({ id, label: name })),
  // No date range: GET /api/catalog/orders treats from/to as optional instants, not civil dates.
  pedido: async () => (await listCatalogOrders()).map(({ id, displayNumber, customerName }) => ({ id, label: `${displayNumber} · ${customerName}` })),
}

export function useAgendaOptions(load: () => Promise<AgendaOption[]>) {
  const [result, setResult] = useState<{ options: AgendaOption[]; loading: boolean; error: boolean }>({ options: [], loading: true, error: false })
  useEffect(() => {
    let active = true
    void load().then(
      (options) => { if (active) setResult({ options, loading: false, error: false }) },
      () => { if (active) setResult({ options: [], loading: false, error: true }) },
    )
    return () => { active = false }
  }, [load])
  return result
}
