import { createContext, useContext } from "react"

import { DEFAULT_TENANT_TIME_ZONE } from "@/lib/tenantTimeZone"

export const TenantTimeZoneContext = createContext(DEFAULT_TENANT_TIME_ZONE)

export function useTenantTimeZone(): string {
  return useContext(TenantTimeZoneContext)
}
