import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StepSubmitContext, useStepSubmit, type StepSubmit } from "./stepSubmit"

function Step({ submit, onDriven }: { submit: StepSubmit; onDriven: (driven: boolean) => void }) {
  onDriven(useStepSubmit(submit))
  return null
}

describe("useStepSubmit", () => {
  it("returns false and registers nothing outside a cadastro shell", () => {
    const onDriven = vi.fn()
    render(<Step submit={async () => true} onDriven={onDriven} />)
    expect(onDriven).toHaveBeenLastCalledWith(false)
  })

  it("registers the latest submit with the shell and unregisters on unmount", async () => {
    let registered: StepSubmit | null = null
    const register = vi.fn((submit: StepSubmit | null) => { registered = submit })
    const onDriven = vi.fn()
    const first = vi.fn(async () => true)
    const second = vi.fn(async () => false)
    const { rerender, unmount } = render(
      <StepSubmitContext value={{ register }}><Step submit={first} onDriven={onDriven} /></StepSubmitContext>,
    )
    expect(onDriven).toHaveBeenLastCalledWith(true)
    rerender(<StepSubmitContext value={{ register }}><Step submit={second} onDriven={onDriven} /></StepSubmitContext>)

    await expect(registered!()).resolves.toBe(false)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    unmount()
    expect(register).toHaveBeenLastCalledWith(null)
  })
})
