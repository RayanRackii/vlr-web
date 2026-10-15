import { afterEach, describe, expect, it } from "vitest"

import { formatMoney, formatReservationRange } from "@/features/rentals/services/reservationsService"
import i18n from "@/lib/i18n"

import {
  formatLocaleCivilDate,
  formatLocaleCurrency,
  formatLocaleDateTimeRange,
} from "./localeFormat"

const START = "2026-09-10T13:00:00.000Z"
const END = "2026-09-10T14:00:00.000Z"

describe("localeFormat", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("formats money with the active locale and the given currency", () => {
    expect(formatLocaleCurrency(80, "BRL", "pt-BR")).toBe("R$ 80,00")
    expect(formatLocaleCurrency(80, "EUR", "pt-BR")).toBe("€ 80,00")
    expect(formatLocaleCurrency(80, "BRL", "en")).toBe("R$80.00")
    expect(formatLocaleCurrency(80, "BRL", "es")).toBe("80,00 BRL")
    expect(formatLocaleCurrency(80, "not-a-currency", "pt-BR")).toBe(
      "80.00 NOT-A-CURRENCY",
    )
  })

  it("formats a civil date as DD/MM in pt-BR and es, and MM/DD in en", () => {
    expect(formatLocaleCivilDate("2026-10-14", "pt-BR")).toBe("14/10/2026")
    expect(formatLocaleCivilDate("2026-10-14", "es")).toBe("14/10/2026")
    expect(formatLocaleCivilDate("2026-10-14", "en")).toBe("10/14/2026")
    expect(formatLocaleCivilDate("not-a-date", "pt-BR")).toBe("not-a-date")
  })

  it("formats a business-clock range in the requested locale", () => {
    expect(formatLocaleDateTimeRange(START, END, "pt-BR")).toContain(
      "10/09/2026",
    )
    expect(formatLocaleDateTimeRange(START, END, "es")).toContain("10/09/2026")
    expect(formatLocaleDateTimeRange(START, END, "en")).toContain("09/10/2026")
    expect(formatLocaleDateTimeRange(START, END, "en")).not.toContain(
      "10/09/2026",
    )
  })

  it("follows the active language in the rentals formatters", async () => {
    await i18n.changeLanguage("pt-BR")
    expect(formatMoney(80)).toBe("R$ 80,00")
    expect(formatMoney(80, "EUR")).toBe("€ 80,00")
    expect(formatReservationRange(START, END)).toContain("10/09/2026")

    await i18n.changeLanguage("en")
    expect(formatMoney(80)).toBe("R$80.00")
    expect(formatReservationRange(START, END)).toContain("09/10/2026")

    await i18n.changeLanguage("es")
    expect(formatReservationRange(START, END)).toContain("10/09/2026")
    expect(formatReservationRange(START, END)).not.toContain("09/10/2026")
  })
})
