import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import i18n from "@/lib/i18n"
import { PlanningApiError } from "../services/planningService"
import { describePlanningError, hoursViolationMessage, knownPlanningErrorCodes } from "./planningErrors"

const languages = ["pt-BR", "en", "es"] as const
const tFor = (lng: string) => i18n.getFixedT(lng) as unknown as TFunction

describe("error messages", () => {
  it.each(languages)("has a readable message for every known code in %s", (lng) => {
    const t = tFor(lng)
    for (const code of knownPlanningErrorCodes) {
      const described = describePlanningError(new PlanningApiError(409, code, "raw server text"), t)
      expect(described.message, code).not.toMatch(/^planning\./)
      expect(described.message, code).not.toBe("raw server text")
      expect(described.message.length, code).toBeGreaterThan(8)
    }
  })

  it("never shows the raw server text or the key for an unknown code", () => {
    const described = describePlanningError(new PlanningApiError(418, "planning.something_new", "raw server text"), tFor("en"))
    expect(described.message).toBe("Could not complete. Try again.")
  })

  it("falls back by status", () => {
    const t = tFor("en")
    expect(describePlanningError(new PlanningApiError(403, "http_403", "x"), t).message).toBe("You do not have permission for this action.")
    expect(describePlanningError(new PlanningApiError(500, "http_500", "x"), t).message).toBe("The server failed. Try again in a moment.")
    expect(describePlanningError(new PlanningApiError(0, "network", "x"), t).message).toContain("No connection")
    expect(describePlanningError(new Error("boom"), t).code).toBe("unknown")
  })

  it.each(languages)("maps the availability profile errors in %s (409, 422 and 400)", (lng) => {
    const t = tFor(lng)
    const authority = describePlanningError(new PlanningApiError(409, "planning.rental_schedule_authority", "x"), t)
    const required = describePlanningError(new PlanningApiError(422, "planning.working_hours_required", "x"), t)
    const invalid = describePlanningError(new PlanningApiError(400, "http_400", "x"), t)
    const version = describePlanningError(new PlanningApiError(409, "planning.version_conflict", "x"), t)
    expect(authority.code).toBe("planning.rental_schedule_authority")
    expect(required.code).toBe("planning.working_hours_required")
    const messages = [authority.message, required.message, invalid.message, version.message]
    for (const message of messages) expect(message).not.toMatch(/^planning./)
    expect(new Set(messages).size).toBe(4)
    expect(invalid.message).not.toBe(t("planning.errors.unknown"))
  })

  it("carries the conflicts of a 409 planning.conflict", () => {
    const conflicts = [{ source: "allocation", allocationId: "x", start: "2026-11-18T12:00:00Z", end: "2026-11-18T13:00:00Z", label: "Peça B" }]
    const described = describePlanningError(new PlanningApiError(409, "planning.conflict", "x", conflicts), tFor("pt-BR"))
    expect(described.message).toBe("O recurso já está ocupado nesse período.")
    expect(described.conflicts).toEqual(conflicts)
  })

  it("explains the working-hours violation on a 422", () => {
    const start = describePlanningError(new PlanningApiError(422, "planning.outside_working_hours", "x", [], "start_outside_working_hours"), tFor("pt-BR"))
    expect(start.hoursViolation).toBe("start_outside_working_hours")
    expect(start.message).toContain("O início precisa cair dentro do horário")
    const whole = describePlanningError(new PlanningApiError(422, "planning.outside_working_hours", "x", [], "outside_working_hours"), tFor("en"))
    expect(whole.message).toContain("whole period must fit")
  })

  it.each(languages)("translates each hours reason in %s", (lng) => {
    for (const reason of ["start_outside_working_hours", "outside_working_hours", "invalid_interval", "something_else"]) {
      expect(hoursViolationMessage(reason, tFor(lng))).not.toMatch(/^planning\./)
    }
  })

  it("keeps the cancel and unavailable 403s distinct from a generic 403", () => {
    const t = tFor("en")
    expect(describePlanningError(new PlanningApiError(403, "planning.cancel_forbidden", "x"), t).message).toContain("created the allocation")
    expect(describePlanningError(new PlanningApiError(403, "planning.unavailable_forbidden", "x"), t).message).toContain("administrator")
    expect(describePlanningError(new PlanningApiError(403, "module_inactive", "x"), t).message).toContain("not active")
  })
})
