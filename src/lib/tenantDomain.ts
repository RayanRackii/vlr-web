/** Apex domain for tenant subdomains (`ficc.{base}`). */
export function getTenantBaseDomain(): string {
  const configured = import.meta.env.VITE_TENANT_BASE_DOMAIN
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().toLowerCase()
  }
  return "rolvix.com.br"
}

/**
 * True when the hostname is the Rolvix product domain (apex, www, or tenant host).
 * Uses the real hostname — not `import.meta.env.PROD`.
 */
export function isProductHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (host.length === 0) {
    return false
  }

  const base = getTenantBaseDomain()
  return (
    host === base || host === `www.${base}` || host.endsWith(`.${base}`)
  )
}
