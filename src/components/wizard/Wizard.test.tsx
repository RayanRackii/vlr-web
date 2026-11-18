import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Wizard } from "@/components/wizard/Wizard"

const steps = [
  { id: "one", label: "One", validate: () => "Choose a space" },
  { id: "two", label: "Two" },
]

describe("Wizard", () => {
  it("keeps the user on an invalid step and exposes an inline error", async () => {
    const user = userEvent.setup()
    render(<Wizard steps={steps} nextLabel="Next" backLabel="Back" finishLabel="Finish" onFinish={vi.fn()}>{(index) => <p>Step {index + 1}</p>}</Wizard>)

    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("One")
    await user.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a space")
    expect(screen.getByText("Step 1")).toBeInTheDocument()
  })

  it("honors initialStep and renders the supplied final review slot", () => {
    render(<Wizard steps={steps} initialStep={1} nextLabel="Next" backLabel="Back" finishLabel="Finish" onFinish={vi.fn()} finalReview={<p>Review</p>}>{() => <p>Content</p>}</Wizard>)

    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("Two")
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument()
  })

  it("supports a controlled step and shows a parent-owned stepError", async () => {
    const user = userEvent.setup()
    const onStepChange = vi.fn()
    render(<Wizard steps={[{ id: "one", label: "One" }, { id: "two", label: "Two" }]} stepIndex={1} onStepChange={onStepChange} stepError="Boom" ariaLabel="Passos" nextLabel="Next" backLabel="Back" finishLabel="Finish" onFinish={vi.fn()}>{(index) => <p>Step {index + 1}</p>}</Wizard>)

    expect(screen.getByText("Step 2")).toBeInTheDocument()
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Boom")
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(onStepChange).toHaveBeenCalledWith(0)
    expect(screen.getByText("Step 2")).toBeInTheDocument()
  })
})
