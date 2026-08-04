/** Apex domain for tenant subdomains (`ficc.{base}`). */
export function getTenantBaseDomain(): string {
  const configured = import.meta.env.VITE_TENANT_BASE_DOMAIN
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().toLowerCase()
  }
  return "rolvix.com.br"
}
