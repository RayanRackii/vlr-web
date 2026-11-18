import type { ReactNode } from "react"
import { Navigate, useLocation, useParams } from "react-router-dom"

import { productEditPath, productEditStepFromLegacyPasso, productEditStepFromLegacyTab, productViewPath } from "@/features/catalog/lib/productEditorPath"

/** Old assistant (`/:id/assistente`, `/:id/passos`) links open the wizard in edit mode at the mapped step. */
export function ProductEditorRedirect() {
  const { id = "" } = useParams()
  const { hash, search } = useLocation()
  const step = productEditStepFromLegacyPasso(new URLSearchParams(search).get("passo"))
  return <Navigate to={`${productEditPath(id, step)}${hash}`} replace />
}

/** `/:id/editar-legado` (the retired tabbed editor) opens the read-only view; `?aba=` keeps its step. */
export function ProductLegacyEditorRedirect() {
  const { id = "" } = useParams()
  const { hash, search } = useLocation()
  return <Navigate to={`${legacyTabTarget(id, new URLSearchParams(search).get("aba"))}${hash}`} replace />
}

function legacyTabTarget(id: string, tab: string | null): string {
  const step = productEditStepFromLegacyTab(tab)
  if (step) return productEditPath(id, step)
  if (tab === "dados") return productEditPath(id, "dados")
  return productViewPath(id)
}

/** The view route: a legacy `/:id?aba=x` link goes to the matching wizard step (history and unknown tabs stay on the view). */
export function ProductViewEntry({ children }: { children: ReactNode }) {
  const { id = "" } = useParams()
  const { hash, search } = useLocation()
  const tab = new URLSearchParams(search).get("aba")
  if (tab === null) return <>{children}</>
  return <Navigate to={`${legacyTabTarget(id, tab)}${hash}`} replace />
}
