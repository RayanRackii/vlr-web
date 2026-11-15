import { Navigate, useLocation, useParams } from "react-router-dom"

import { productEditorPath, productEditorTabFromLegacy } from "@/features/catalog/lib/productEditorPath"

/** Old assistant (`/:id/assistente`, `/:id/passos`) links open the single product editor. */
export function ProductEditorRedirect() {
  const { id = "" } = useParams()
  const { hash, search } = useLocation()
  const tab = productEditorTabFromLegacy(new URLSearchParams(search).get("passo"))
  return <Navigate to={`${productEditorPath(id, tab)}${hash}`} replace />
}
