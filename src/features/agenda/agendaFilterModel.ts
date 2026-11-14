import { useSyncExternalStore } from "react"
import type { AgendaState } from "./urlState"

const MEDIUM = "(min-width: 768px)"

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(MEDIUM)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True from `md`; without matchMedia (tests, old browsers) the desktop layout is assumed. */
export function useIsMedium() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== "function" || window.matchMedia(MEDIUM).matches,
    () => true,
  )
}

export type AgendaResource = { id: string; name: string; categoryId?: string | null; categoryName?: string | null }
export type AgendaFilterPatch = Partial<Pick<AgendaState, "recursos" | "produto" | "pedido" | "tipo" | "livres" | "fechadas">>

export function activeFilterCount(state: AgendaState) {
  return [state.recursos.length > 0, state.produto, state.pedido, state.tipo, state.livres, state.fechadas].filter(Boolean).length
}

export const clearPatch: Required<AgendaFilterPatch> = { recursos: [], produto: null, pedido: null, tipo: null, livres: false, fechadas: false }

type Group = { key: string; name: string; resources: AgendaResource[] }

/** Resources grouped by `categoryName` ("Sem categoria" when missing), in first-seen order. */
export function groupResources(resources: AgendaResource[], fallback: string): Group[] {
  const groups = new Map<string, Group>()
  for (const resource of resources) {
    const name = resource.categoryName?.trim() || fallback
    const group = groups.get(name) ?? { key: name, name, resources: [] }
    group.resources.push(resource)
    groups.set(name, group)
  }
  return [...groups.values()]
}

/** Accent- and case-insensitive text match, shared by the order search and the resource tree. */
export function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/#/g, "")
}

/** Ids of the resources the filter keeps: `recursos` empty (or matching nothing) means every resource; a stored id may be a legacy category id. */
export function selectedResourceIds(recursos: string[], resources: AgendaResource[]): Set<string> {
  const byCategory = (id: string) => resources.filter((resource) => resource.categoryId === id).map((resource) => resource.id)
  const stored = new Set(recursos.flatMap((id) => (resources.some((resource) => resource.id === id) ? [id] : byCategory(id))))
  return recursos.length === 0 || stored.size === 0 ? new Set(resources.map((resource) => resource.id)) : stored
}
