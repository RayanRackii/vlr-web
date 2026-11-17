import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StepSubmitContext, type StepSubmit } from "@/features/assistant/stepSubmit"
import { ProductWizardFilesStep } from "@/features/catalog/components/productWizard/ProductWizardFilesStep"

vi.mock("@/features/catalog/services/catalogService", () => ({
  deleteCatalogProductFile: vi.fn(), getCatalogProductFileUrl: vi.fn(), uploadCatalogProductFile: vi.fn(),
}))

describe("ProductWizardFilesStep", () => {
  it("registers a submit that resolves true because files save immediately", async () => {
    let registered: StepSubmit | null = null
    render(<StepSubmitContext.Provider value={{ register: (submit) => { registered = submit } }}>
      <ProductWizardFilesStep product={{ id: "p", name: "Quadra", files: [] }} canManage onReload={vi.fn()} />
    </StepSubmitContext.Provider>)
    expect(screen.getByTestId("product-files-manager")).toBeInTheDocument()
    expect(registered).not.toBeNull()
    await expect((registered as unknown as StepSubmit)()).resolves.toBe(true)
  })
})
