import { Navigate, useParams } from "react-router-dom"

/** Old equipment-type editor. The list and the create path moved to resource types. */
export function CategoryLegacyRedirect() {
  const splat = (useParams()["*"] ?? "").replace(/^\/+|\/+$/g, "")
  const head = splat.split("/").filter(Boolean)[0]
  return <Navigate to={head === "novo" ? "/ativos/tipos/novo" : "/ativos/tipos"} replace />
}
