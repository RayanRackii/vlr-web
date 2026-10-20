import { describe, expect, it } from "vitest"

import {
  formatCartTotalText,
  formatLineSubtotal,
  formatOrderTotalText,
  summarizeCartPrices,
  summarizeOrderPrices,
} from "@/features/catalog/lib/catalogPriceSummary"

const labels = {
  onRequest: "Sob consulta",
  partial: (amount: string) => `A partir de ${amount}`,
}

const orderLabels = {
  onRequest: "Sob consulta",
  partial: (amount: string) => `${amount} · Sob consulta`,
}

describe("catalog price summary", () => {
  it("sums priced cart lines and marks a mixed cart as a partial total", () => {
    const lines = [
      { price: 10, currency: "BRL", quantity: 2 },
      { price: null, currency: "BRL", quantity: 1 },
    ]

    expect(summarizeCartPrices(lines)).toEqual({
      priced: [{ currency: "BRL", amount: 20 }],
      hasUnpriced: true,
    })
    expect(formatLineSubtotal(10, "BRL", 2, "pt-BR", "Sob consulta")).toBe(
      "R$ 20,00",
    )
    expect(formatLineSubtotal(null, "BRL", 1, "pt-BR", "Sob consulta")).toBe(
      "Sob consulta",
    )
    expect(formatCartTotalText(lines, "pt-BR", labels)).toBe(
      "A partir de R$ 20,00",
    )
  })

  it("shows only the on-request label when every cart line is unpriced", () => {
    expect(
      formatCartTotalText(
        [{ price: null, currency: "BRL", quantity: 3 }],
        "pt-BR",
        labels,
      ),
    ).toBe("Sob consulta")
  })

  it("shows an exact cart total when every line has a price", () => {
    expect(
      formatCartTotalText(
        [
          { price: 10, currency: "brl", quantity: 1 },
          { price: 5.5, currency: "BRL", quantity: 2 },
        ],
        "pt-BR",
        labels,
      ),
    ).toBe("R$ 21,00")
  })

  it("keeps the known order sum when the server total is null", () => {
    const order = {
      totalAmount: null,
      currency: "BRL",
      items: [
        { subTotal: 15, currency: "BRL" },
        { subTotal: null, currency: "BRL" },
        { subTotal: 5, currency: "BRL" },
      ],
    }

    expect(summarizeOrderPrices(order)).toEqual({
      priced: [{ currency: "BRL", amount: 20 }],
      hasUnpriced: true,
    })
    expect(formatOrderTotalText(order, "pt-BR", orderLabels)).toBe(
      "R$ 20,00 · Sob consulta",
    )
  })

  it("uses the server total when the API already sent one", () => {
    expect(
      formatOrderTotalText(
        {
          totalAmount: 40,
          currency: "BRL",
          items: [
            { subTotal: 40, currency: "BRL" },
            { subTotal: null, currency: "BRL" },
          ],
        },
        "en",
        orderLabels,
      ),
    ).toBe("R$ 40.00")
  })

  it("does not add amounts in different currencies", () => {
    expect(
      formatOrderTotalText(
        {
          totalAmount: null,
          currency: "BRL",
          items: [
            { subTotal: 10, currency: "BRL" },
            { subTotal: 4, currency: "EUR" },
          ],
        },
        "pt-BR",
        orderLabels,
      ),
    ).toBe("R$ 10,00 + € 4,00")
  })
})