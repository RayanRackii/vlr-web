import { bookingIdleRedirectPathSchema } from "@/features/tenantPortal/schemas/bookingIdleSettingsSchema"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

/** The configured path is relative to this portal in both host and path modes. */
export function bookingIdleRedirectTarget(
  subdomain: string,
  configuredPath: string | null | undefined,
): string {
  if (!configuredPath || !bookingIdleRedirectPathSchema.safeParse(configuredPath).success) {
    return tenantPortalPath(subdomain, "app")
  }
  const base = tenantPortalPath(subdomain).replace(/\/$/, "")
  const target = new URL(configuredPath, "https://portal.invalid")
  const pathname = target.pathname.replace(/^\/+/, "/")
  const path = `${pathname}${target.search}${target.hash}`
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return path
  }
  return `${base}${path}`
}
