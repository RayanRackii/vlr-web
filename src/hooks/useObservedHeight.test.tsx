import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useObservedHeight } from "@/hooks/useObservedHeight"

function Probe() {
  const observed = useObservedHeight<HTMLDivElement>()

  return (
    <div>
      <div ref={observed.ref} data-testid="bar" />
      <output>{observed.height}</output>
    </div>
  )
}

describe("useObservedHeight", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("publishes the observed element height", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const height = this.dataset.testid === "bar" ? 88 : 0
        return {
          x: 0,
          y: 0,
          width: 0,
          height,
          top: 0,
          right: 0,
          bottom: height,
          left: 0,
          toJSON() {
            return {}
          },
        }
      },
    )

    const observe = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe
        disconnect() {}
        unobserve() {}
      },
    )

    render(<Probe />)

    expect(await screen.findByText("88")).toBeInTheDocument()
    expect(observe).toHaveBeenCalled()
  })
})
