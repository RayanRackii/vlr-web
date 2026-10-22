import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"

describe("LayoutCanvasBoard visual art", () => {
  it("renders published art as an image instead of injecting SVG markup", () => {
    const { container } = render(<LayoutCanvasBoard mode="pick" items={[{ key: "one", rentalAssetId: "11111111-1111-4111-8111-111111111111", label: "Room", xPercent: 0, yPercent: 0, widthPercent: 50, heightPercent: 50, zIndex: 1, artUrl: "https://api.test/art.svg" }]} />)
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://api.test/art.svg")
    expect(container.querySelector("svg")).toBeNull()
  })
})
