const orderRoute = /^\/t\/([a-z0-9-]+)\/pedidos(?:\/([A-Za-z0-9-]{1,64}))?\/?$/

/**
 * Restrict API-provided destinations to an allowlist inside the current customer
 * portal: the orders list or one order detail. Query strings and hashes are
 * dropped so no follow-up redirect (`returnTo`, staff aliases) can escape.
 */
export function sanitizeCustomerNotificationRoute(route: string, subdomain: string): string {
  const slug = subdomain.trim().toLowerCase()
  const fallback = `/t/${slug}/pedidos`
  const match = orderRoute.exec(route)
  if (!match || match[1] !== slug) return fallback
  return match[2] ? `${fallback}/${match[2]}` : fallback
}
