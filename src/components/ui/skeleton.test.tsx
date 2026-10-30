import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Skeleton } from "./skeleton"

describe("Skeleton reduced motion", () => {
  it("hides shimmer while preserving the static background and disables pulse", () => {
    const { container, rerender } = render(<Skeleton />)
    expect(container.firstElementChild).toHaveClass("bg-muted")
    expect(container.querySelector("span")).toHaveClass("motion-reduce:hidden")
    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true")

    rerender(<Skeleton variant="pulse" />)
    expect(container.firstElementChild).toHaveClass("bg-muted", "motion-reduce:animate-none")
    expect(container.querySelector("span")).toBeNull()
  })
})
