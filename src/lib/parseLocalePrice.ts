/** Largest price accepted by the price editors (generic sanity cap). */
export const MAX_PRICE = 1_000_000

export type PriceParseError = "required" | "invalid" | "notPositive" | "tooLarge"

export type PriceParseResult =
  | { ok: true; value: number }
  | { ok: false; error: PriceParseError }

const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/

/**
 * Parses a price typed in pt-BR (or plain) notation.
 * "12,5" -> 12.5, "1.234,56" -> 1234.56, "1.234" -> 1234, "12.5" -> 12.5.
 * Rejects blank, non-numeric, more than 2 decimals, <= 0 and > MAX_PRICE.
 */
export function parseLocalePrice(input: string): PriceParseResult {
  const text = input.replace(/R\$/gi, "").replace(/\s/g, "")
  if (text === "") return { ok: false, error: "required" }
  if (text.startsWith("-")) return { ok: false, error: "notPositive" }

  let normalized: string
  if (text.includes(",")) {
    const [intPart, decPart, ...rest] = text.split(",")
    if (rest.length > 0 || decPart === undefined) return { ok: false, error: "invalid" }
    if (intPart.includes(".") && !THOUSANDS_ONLY.test(intPart)) return { ok: false, error: "invalid" }
    normalized = `${intPart.replace(/\./g, "") || "0"}.${decPart}`
  } else if (THOUSANDS_ONLY.test(text)) {
    normalized = text.replace(/\./g, "")
  } else {
    normalized = text
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false, error: "invalid" }
  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, error: "invalid" }
  if (value <= 0) return { ok: false, error: "notPositive" }
  if (value > MAX_PRICE) return { ok: false, error: "tooLarge" }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

export function isValidPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_PRICE
}

/** Formats a stored price for editing in pt-BR style ("12,50"); blank when unset/invalid. */
export function formatPriceForInput(value: number): string {
  if (!isValidPrice(value)) return ""
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
