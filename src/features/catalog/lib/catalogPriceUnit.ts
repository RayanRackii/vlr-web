import type { TFunction } from "i18next"

import {
  CATALOG_PRICE_UNITS,
  catalogPriceUnitSchema,
  type CatalogPriceUnit,
} from "@/features/catalog/schemas/catalogSchemas"

export const CATALOG_PRICE_UNIT_OPTIONS: readonly CatalogPriceUnit[] = CATALOG_PRICE_UNITS

/** Narrows a stored/form value to a known unit; anything else means "no unit". */
export function parsePriceUnit(value: string | null | undefined): CatalogPriceUnit | null {
  const parsed = catalogPriceUnitSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** "por unidade", "por hora"... or null when the product has no unit. */
export function priceUnitSuffix(
  t: TFunction,
  unit: string | null | undefined,
): string | null {
  const parsed = parsePriceUnit(unit)
  return parsed ? t(`catalog.priceUnit.suffix.${parsed}`) : null
}

/** "R$ 45,00 por unidade"; just the price when there is no unit. */
export function withPriceUnit(
  t: TFunction,
  price: string,
  unit: string | null | undefined,
): string {
  const suffix = priceUnitSuffix(t, unit)
  return suffix ? `${price} ${suffix}` : price
}
