const STORAGE_KEY = "rolvix.supportTenant"

export type SupportTenantSession = {
  id: string
  legalName: string
}

export function readSupportTenantSession(): SupportTenantSession | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<SupportTenantSession>
    if (
      typeof parsed.id === "string" &&
      parsed.id.length > 0 &&
      typeof parsed.legalName === "string"
    ) {
      return { id: parsed.id, legalName: parsed.legalName }
    }
  } catch {
    // ignore corrupt storage
  }

  return null
}

export function writeSupportTenantSession(
  session: SupportTenantSession | null,
) {
  if (typeof window === "undefined") {
    return
  }

  if (!session) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getSupportTenantIdForApi(): string | null {
  return readSupportTenantSession()?.id ?? null
}

export function openSupportTenantEnvironment(tenant: {
  id: string
  legalName: string
}) {
  const url = new URL("/dashboard", window.location.origin)
  url.searchParams.set("supportTenantId", tenant.id)
  url.searchParams.set("supportTenantName", tenant.legalName)
  window.open(url.toString(), "_blank", "noopener,noreferrer")
}
