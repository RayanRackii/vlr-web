import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageHeader } from "@/components/layout/PageHeader"

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Reservas" />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Reservas" }),
    ).toBeInTheDocument()
  })

  it("renders the description when provided", () => {
    render(<PageHeader title="Reservas" description="Gerencie as reservas" />)

    expect(screen.getByText("Gerencie as reservas")).toBeInTheDocument()
  })

  it("omits the description paragraph when not provided", () => {
    const { container } = render(<PageHeader title="Reservas" />)

    expect(container.querySelector("p")).toBeNull()
  })

  it("renders actions when provided", () => {
    render(
      <PageHeader
        title="Reservas"
        actions={<button type="button">Nova reserva</button>}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Nova reserva" }),
    ).toBeInTheDocument()
  })
})
