import { describe, expect, it } from "vitest"

import { formatReservationRange } from "@/features/rentals/services/reservationsService"
import i18n from "@/lib/i18n"

describe("formatReservationRange multi-day spans", () => {
  it("shows a single date and time range for a same-day reservation", async () => {
    await i18n.changeLanguage("pt-BR")
    expect(
      formatReservationRange(
        "2026-09-08T11:00:00.000Z",
        "2026-09-08T14:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("08/09/2026 08:00 – 11:00")
  })

  it("shows a dd/MM range with the day count for a multi-day reservation", async () => {
    await i18n.changeLanguage("pt-BR")
    expect(
      formatReservationRange(
        "2026-09-08T11:00:00.000Z",
        "2026-09-10T14:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("08/09 – 10/09 (3 dias)")
  })

  it("does not advance a 23:59:59 inclusive end into the next display date", async () => {
    await i18n.changeLanguage("pt-BR")
    expect(
      formatReservationRange(
        "2026-09-08T11:00:00.000Z",
        "2026-09-11T02:59:59.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("08/09 – 10/09 (3 dias)")
  })
})
