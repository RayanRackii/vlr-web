import { expect, it } from "vitest"
import { addCivilDays, civilDaysBetween, formatHumanDate, sectionFor } from "./agendaModel"

it("does civil date arithmetic without timezone drift", () => {
  expect(addCivilDays("2026-11-14", 6)).toBe("2026-11-20")
  expect(addCivilDays("2026-12-30", 3)).toBe("2027-01-02")
  expect(civilDaysBetween("2026-06-26", "2026-11-14")).toBe(141)
})
it("splits dates into overdue, this week and upcoming", () => {
  expect(sectionFor("2026-11-13", "2026-11-14")).toBe("overdue")
  expect(sectionFor("2026-11-14", "2026-11-14")).toBe("week")
  expect(sectionFor("2026-11-20", "2026-11-14")).toBe("week")
  expect(sectionFor("2026-11-21", "2026-11-14")).toBe("upcoming")
})
it("formats civil dates in a human pt-BR style", () => {
  expect(formatHumanDate("2026-06-26", "pt-BR")).toBe("26 jun 2026")
  expect(formatHumanDate("bad", "pt-BR")).toBe("bad")
})
