type StaffTenantName = {
  tenantTradeName?: string | null
  tenantLegalName?: string | null
}

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? ""
}

/** Trade name, then legal name, then the caller fallback. */
export function staffHeaderContextLabel(
  user: StaffTenantName | null | undefined,
  fallback: string,
): string {
  const tradeName = trimmed(user?.tenantTradeName)
  if (tradeName.length > 0) {
    return tradeName
  }

  const legalName = trimmed(user?.tenantLegalName)
  if (legalName.length > 0) {
    return legalName
  }

  return fallback
}
