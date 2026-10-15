import {
  normalizeBrazilianPhoneDigits,
  onlyDigits,
  type CustomerType,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"

/**
 * Progressive mask for the signup phone field.
 * National input becomes `(DD) NNNN-NNNN` or `(DD) NNNNN-NNNN`.
 * A leading `+` / `00`, or a pasted value long enough to include country code 55,
 * becomes E.164 (`+55 (DD) …` or a generic `+` grouping).
 * The API still receives digits from `normalizeBrazilianPhoneDigits`.
 */
export function maskPhoneInput(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return ""
  }

  const compact = trimmed.replace(/[^\d+]/g, "")
  const international = compact.startsWith("+") || compact.startsWith("00")
  let digits = onlyDigits(trimmed)
  if (international && digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  if (international || (digits.startsWith("55") && digits.length >= 12)) {
    if (digits.startsWith("55")) {
      return formatBrazilE164(digits)
    }
    return formatGenericE164(digits)
  }

  return formatBrazilNational(digits)
}

/** Privacy mask. CPF `12345678901` → `***.456.789-**`. */
export function maskCpf(raw: string | null | undefined): string {
  const digits = onlyDigits(raw ?? "")
  if (digits.length !== 11) {
    return maskUnknownDigits(digits)
  }
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

/** Privacy mask. CNPJ keeps the same middle group visible as CPF. */
export function maskCnpj(raw: string | null | undefined): string {
  const digits = onlyDigits(raw ?? "")
  if (digits.length !== 14) {
    return maskUnknownDigits(digits)
  }
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-**`
}

/**
 * Privacy mask for a stored phone.
 * Mobile `11988880001` → `(11) *****-0001`. Landline keeps the last four.
 */
export function maskBrazilianPhone(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ""
  if (trimmed.length === 0) {
    return ""
  }

  const digits = normalizeBrazilianPhoneDigits(trimmed)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) *****-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ****-${digits.slice(6)}`
  }
  return maskUnknownDigits(digits)
}

export function maskCustomerDocument(
  customerType: CustomerType | undefined,
  document: string | null | undefined,
  cpf: string | null | undefined,
): string | null {
  const digits = onlyDigits(document ?? cpf ?? "")
  if (digits.length === 0) {
    return null
  }
  if (customerType === "Company" || digits.length === 14) {
    return maskCnpj(digits)
  }
  if (digits.length === 11) {
    return maskCpf(digits)
  }
  return maskUnknownDigits(digits)
}

function formatBrazilNational(digits: string): string {
  const value = digits.slice(0, 11)
  if (value.length === 0) {
    return ""
  }
  if (value.length <= 2) {
    return `(${value}`
  }
  if (value.length <= 6) {
    return `(${value.slice(0, 2)}) ${value.slice(2)}`
  }
  if (value.length <= 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
  }
  return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
}

function formatBrazilE164(digits: string): string {
  const national = digits.slice(2, 13)
  if (national.length === 0) {
    return "+55"
  }
  return `+55 ${formatBrazilNational(national)}`
}

function formatGenericE164(digits: string): string {
  const value = digits.slice(0, 15)
  if (value.length === 0) {
    return "+"
  }
  const parts: string[] = []
  for (let index = 0; index < value.length; index += 3) {
    parts.push(value.slice(index, index + 3))
  }
  return `+${parts.join(" ")}`
}

function maskUnknownDigits(digits: string): string {
  if (digits.length === 0) {
    return ""
  }
  if (digits.length <= 2) {
    return "*".repeat(digits.length)
  }
  return `${"*".repeat(digits.length - 2)}${digits.slice(-2)}`
}
