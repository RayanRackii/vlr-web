import { useSyncExternalStore } from "react"
import type { AgendaState } from "./urlState"

const DESKTOP = "(min-width: 1024px)"
export const COLLAPSE_KEY = "rolvix.agenda.filters.collapsed"

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(DESKTOP)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True from `lg`; without matchMedia (tests, old browsers) the desktop layout is assumed. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== "function" || window.matchMedia(DESKTOP).matches,
    () => true,
  )
}

export function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0")
  } catch {
    // Storage can be blocked; the panel still works for this visit.
  }
}

export type AgendaResource = { id: string; name: string; categoryId?: string | null; categoryName?: string | null }
export type AgendaFilterPatch = Partial<Pick<AgendaState, "recursos" | "produto" | "pedido" | "tipo" | "livres" | "fechadas">>

export function activeFilterCount(state: AgendaState) {
  return [state.recursos.length > 0, state.produto, state.pedido, state.tipo, state.livres, !state.fechadas].filter(Boolean).length
}

export const clearPatch: Required<AgendaFilterPatch> = { recursos: [], produto: null, pedido: null, tipo: null, livres: false, fechadas: true }

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
