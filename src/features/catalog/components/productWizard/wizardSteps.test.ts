import { describe, expect, it } from "vitest"

import {
  isProductWizardStep,
  moveProductWizardStep,
  productGroupDeepLink,
  productWizardPath,
  productWizardStepFromQuery,
} from "@/features/catalog/components/productWizard/wizardSteps"

const ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

describe("product wizard steps", () => {
  it("accepts only the four setup steps", () => {
    expect(isProductWizardStep("status")).toBe(true)
    expect(isProductWizardStep("offer")).toBe(true)
    expect(isProductWizardStep("access")).toBe(true)
    expect(isProductWizardStep("resource")).toBe(true)
    expect(isProductWizardStep("agenda")).toBe(false)
    expect(isProductWizardStep("")).toBe(false)
  })

  it("falls back to the checklist when the query is missing or unknown", () => {
    expect(productWizardStepFromQuery(null)).toBe("status")
    expect(productWizardStepFromQuery("prices")).toBe("status")
    expect(productWizardStepFromQuery("access")).toBe("access")
  })

  it("moves one step and stays on the ends", () => {
    expect(moveProductWizardStep("status", -1)).toBe("status")
    expect(moveProductWizardStep("status", 1)).toBe("offer")
    expect(moveProductWizardStep("offer", 1)).toBe("access")
    expect(moveProductWizardStep("access", 1)).toBe("resource")
    expect(moveProductWizardStep("resource", 1)).toBe("resource")
    expect(moveProductWizardStep("access", -1)).toBe("offer")
  })

  it("omits the step query on the checklist and encodes the product id", () => {
    expect(productWizardPath(ID)).toBe(`/catalogo/produtos/${ID}/assistente`)
    expect(productWizardPath(ID, "resource")).toBe(
      `/catalogo/produtos/${ID}/assistente?passo=resource`,
    )
    expect(productWizardPath("a/b", "offer")).toBe(
      "/catalogo/produtos/a%2Fb/assistente?passo=offer",
    )
  })

  it("builds a group link that returns to the wizard", () => {
    const href = productGroupDeepLink("group-1", productWizardPath(ID, "access"))
    expect(href).toBe(
      `/catalogo/grupos/group-1?returnTo=${encodeURIComponent(productWizardPath(ID, "access"))}`,
    )
  })
})
