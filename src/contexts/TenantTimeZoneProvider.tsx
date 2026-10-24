import { useMemo, type ReactNode } from "react"

import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"

export function TenantTimeZoneProvider({
  children,
  timeZoneId,
}: {
  children: ReactNode
  timeZoneId?: string | null
}) {
  const resolved = useMemo(
    () => resolveTenantTimeZone(timeZoneId),
    [timeZoneId],
  )

  return (
    <TenantTimeZoneContext.Provider value={resolved}>
      {children}
    </TenantTimeZoneContext.Provider>
  )
}
