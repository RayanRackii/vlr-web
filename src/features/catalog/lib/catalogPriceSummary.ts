import { formatCatalogMoney } from "@/features/catalog/schemas/catalogSchemas"

export type CatalogAmountLine = {
  amount: number | null
  currency: string
}

export type CatalogPricedTotal = {
  currency: string
  amount: number
}

export type CatalogAmountSummary = {
  priced: CatalogPricedTotal[]
  hasUnpriced: boolean
}

export type CatalogAmountLabels = {
  onRequest: string
  partial: (amount: string) => string
}

type OrderPriceSource = {
  totalAmount: number | null
  currency: string
  items: readonly { subTotal: number | null; currency: string }[]
}

type CartPriceLine = {
  price: number | null
  currency: string
  quantity: number
}

function currencyKey(currency: string): string {
  return currency.trim().toUpperCase()
}

/** Sums known amounts and keeps unpriced lines out of that sum. */
export function summarizeLineAmounts(
  lines: readonly CatalogAmountLine[],
): CatalogAmountSummary {
  const totals = new Map<string, number>()
  let hasUnpriced = false

  for (const line of lines) {
    const currency = currencyKey(line.currency)
    if (line.amount == null || !Number.isFinite(line.amount) || currency.length === 0) {
      hasUnpriced = true
      continue
    }
    totals.set(currency, (totals.get(currency) ?? 0) + line.amount)
  }

  const priced = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount }))

  return { priced, hasUnpriced }
}

export function summarizeCartPrices(
  lines: readonly CartPriceLine[],
): CatalogAmountSummary {
  return summarizeLineAmounts(
    lines.map((line) => ({
      amount:
        line.price == null || !Number.isFinite(line.price)
          ? null
          : line.price * line.quantity,
      currency: line.currency,
    })),
  )
}

/**
 * A server total is the full sum. A null total means at least one line has no
 * price; the known line subtotals stay visible.
 */
export function summarizeOrderPrices(order: OrderPriceSource): CatalogAmountSummary {
  if (order.totalAmount != null && Number.isFinite(order.totalAmount)) {
    return summarizeLineAmounts([
      { amount: order.totalAmount, currency: order.currency },
    ])
  }

  return summarizeLineAmounts(
    order.items.map((item) => ({
      amount: item.subTotal,
      currency: item.currency.length > 0 ? item.currency : order.currency,
    })),
  )
}

export function formatCatalogAmountSummary(
  summary: CatalogAmountSummary,
  locale: string,
  labels: CatalogAmountLabels,
): string {
  const amounts = summary.priced.flatMap((part) => {
    const formatted = formatCatalogMoney(part.amount, part.currency, locale)
    return formatted == null ? [] : [formatted]
  })

  if (amounts.length === 0) {
    return labels.onRequest
  }

  const joined = amounts.join(" + ")
  if (summary.hasUnpriced) {
    return labels.partial(joined)
  }

  return joined
}

export function formatOrderTotalText(
  order: OrderPriceSource,
  locale: string,
  labels: CatalogAmountLabels,
): string {
  return formatCatalogAmountSummary(summarizeOrderPrices(order), locale, labels)
}

export function formatCartTotalText(
  lines: readonly CartPriceLine[],
  locale: string,
  labels: CatalogAmountLabels,
): string {
  return formatCatalogAmountSummary(summarizeCartPrices(lines), locale, labels)
}

export function formatLineSubtotal(
  price: number | null,
  currency: string,
  quantity: number,
  locale: string,
  onRequest: string,
): string {
  if (price == null || !Number.isFinite(price)) {
    return onRequest
  }

  return formatCatalogMoney(price * quantity, currency, locale) ?? onRequest
}
