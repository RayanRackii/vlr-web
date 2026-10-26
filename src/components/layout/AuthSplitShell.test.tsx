import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuthSplitShell } from "@/components/layout/AuthSplitShell"

describe("AuthSplitShell", () => {
  it("centers the brand panel content and anchors the footnote to the bottom", () => {
    render(
      <AuthSplitShell
        brandPanel={<h2>Brand name</h2>}
        brandFootnote={<p>Tecnologia Rolvix</p>}
        mobileBrand={<span>Mobile brand</span>}
      >
        <div>form content</div>
      </AuthSplitShell>,
    )

    const brandHeading = screen.getByText("Brand name")
    const centeredWrapper = brandHeading.parentElement
    expect(centeredWrapper).toHaveClass("flex-1", "justify-center")

    const brandPanelContainer = centeredWrapper?.parentElement
    expect(brandPanelContainer).not.toHaveClass("justify-between")

    const footnote = screen.getByText("Tecnologia Rolvix")
    expect(footnote.parentElement).toBe(brandPanelContainer)
  })
})
