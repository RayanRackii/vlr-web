import { onlyDigits } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

/** Progressive CPF (11 digits) or CNPJ (14 digits) mask: 000.000.000-00 / 00.000.000/0000-00. */
export function maskTaxIdInput(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 14)
  if (digits.length <= 11) {
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)]
    const tail = digits.slice(9)
    let out = parts.filter(Boolean).join(".")
    if (tail) out += `-${tail}`
    return out
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/** Progressive CEP mask: 00000-000. */
export function maskCepInput(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const
