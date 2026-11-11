import { Navigate, useLocation, useParams } from "react-router-dom"

import { cadastroPassoFromLegacy } from "@/features/assistant/useCadastroStep"

function redirectTo(pathname: string, search: URLSearchParams, hash = "") {
  const query = search.toString()
  return <Navigate to={{ pathname, search: query ? `?${query}` : "", hash }} replace />
}

function useCurrentSearch() {
  const location = useLocation()
  return { location, search: new URLSearchParams(location.search) }
}

function withAba(search: URLSearchParams, aba: string) {
  if (!search.has("aba")) search.set("aba", aba)
}

/** Keeps the current query and hash. `:param` tokens are filled from the route. */
export function RedirectKeepingLocation({ to }: { to: string }) {
  const params = useParams()
  const { location, search } = useCurrentSearch()
  const pathname = to.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => encodeURIComponent(params[key] ?? ""))
  return redirectTo(pathname, search, location.hash)
}

export function OrdersListLegacyRedirect() {
  const { location, search } = useCurrentSearch()
  if (search.get("visao") === "agenda") {
    search.delete("visao")
    return redirectTo("/agendas/produto", search, location.hash)
  }
  withAba(search, "pedidos")
  return redirectTo("/pedidos", search, location.hash)
}

export function RequestsListLegacyRedirect() {
  const { location, search } = useCurrentSearch()
  withAba(search, "solicitacoes")
  return redirectTo("/pedidos", search, location.hash)
}

export function MaintenanceListLegacyRedirect({ aba }: { aba: "planos" | "ordens" }) {
  const { location, search } = useCurrentSearch()
  withAba(search, aba)
  return redirectTo("/manutencao", search, location.hash)
}

export function NotificationsLegacyRedirect({ history = false }: { history?: boolean }) {
  const { location, search } = useCurrentSearch()
  if (history || location.hash === "#entregas" || location.hash === "#historico") search.set("aba", "historico")
  search.delete("tab")
  return redirectTo("/notificacoes", search)
}

export function CadastroLegacyRedirect({ area }: { area: "produtos" | "recursos" }) {
  const { id } = useParams()
  const { location, search } = useCurrentSearch()
  const passo = cadastroPassoFromLegacy(search.get("passo"))
  if (passo) search.set("passo", passo)
  else search.delete("passo")
  const base = area === "produtos" ? "/catalogo/produtos" : "/configuracoes/recursos"
  const pathname = id ? `${base}/${encodeURIComponent(id)}/cadastro` : `${base}/cadastro`
  return redirectTo(pathname, search, location.hash)
}
