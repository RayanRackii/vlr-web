import { describe, expect, it } from "vitest"

import {
  moveResourceWizardStep,
  resourceWizardPath,
  resourceWizardStepFromQuery,
  RESOURCE_WIZARD_STEPS,
  scheduleAssetIdFromSearch,
  scheduleDeepLink,
  scheduleTabFromSearch,
} from "@/features/rentals/components/resourceWizard/wizardSteps"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

describe("resource wizard step navigation", () => {
  it("keeps the four steps in hub order", () => {
    expect(RESOURCE_WIZARD_STEPS).toEqual(["status", "rules", "prices", "agenda"])
  })

  it("starts on status when the query is missing or unknown", () => {
    expect(resourceWizardStepFromQuery(null)).toBe("status")
    expect(resourceWizardStepFromQuery("semana")).toBe("status")
  })

  it("moves forward and back without leaving the stepper", () => {
    expect(moveResourceWizardStep("status", -1)).toBe("status")
    expect(moveResourceWizardStep("status", 1)).toBe("rules")
    expect(moveResourceWizardStep("rules", 1)).toBe("prices")
    expect(moveResourceWizardStep("prices", 1)).toBe("agenda")
    expect(moveResourceWizardStep("agenda", 1)).toBe("agenda")
    expect(moveResourceWizardStep("agenda", -1)).toBe("prices")
  })

  it("builds a path that can return to a later step", () => {
    expect(resourceWizardPath(ID)).toBe(`/configuracoes/recursos/${ID}/cadastro`)
    expect(resourceWizardPath(ID, "agenda")).toBe(
      `/configuracoes/recursos/${ID}/cadastro?passo=agenda`,
    )
  })

  it("reads a schedule deep link for one item", () => {
    const href = scheduleDeepLink(ID, "tipos", resourceWizardPath(ID))
    expect(scheduleTabFromSearch(href.slice(href.indexOf("?")))).toBe("kinds")
    expect(scheduleAssetIdFromSearch(href.slice(href.indexOf("?")))).toBe(ID)
    expect(scheduleTabFromSearch("?aba=semana")).toBe("templates")
    expect(scheduleAssetIdFromSearch("")).toBeNull()
  })
})
