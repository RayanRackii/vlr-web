import { Navigate, useOutletContext } from "react-router-dom"

import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

/** `/login` has no dedicated screen — customer login already lives at the portal root. */
export function TenantPortalLoginRedirectRoute() {
  const { subdomain } = useOutletContext<TenantPortalOutletContext>()
  return <Navigate to={tenantPortalPath(subdomain)} replace />
}
