import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LocaleDateInput } from "@/components/LocaleDateInput"

describe("LocaleDateInput", () => {
  it("shows DD/MM for pt-BR and es while keeping the ISO value", () => {
    const { rerender } = render(
      <div>
        <label htmlFor="day">Data</label>
        <LocaleDateInput
          id="day"
          locale="pt-BR"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </div>,
    )

    expect(screen.getByText("14/10/2026")).toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toHaveValue("2026-10-14")

    rerender(
      <label>
        Fecha
        <LocaleDateInput
          locale="es"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </label>,
    )
    expect(screen.getByText("14/10/2026")).toBeInTheDocument()

    rerender(
      <label>
        Date
        <LocaleDateInput
          locale="en"
          value="2026-10-14"
          onChange={() => undefined}
        />
      </label>,
    )
    expect(screen.getByText("10/14/2026")).toBeInTheDocument()
    expect(screen.queryByText("14/10/2026")).not.toBeInTheDocument()
  })
})
