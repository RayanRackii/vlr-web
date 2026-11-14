import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { PageHeader } from "@/components/layout/PageHeader"
import { ShellContext } from "@/components/layout/ShellContext"

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

  it("renders a back link and eyebrow", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Reservas" eyebrow="Operação" back={{ to: "/agendas", label: "Voltar" }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/agendas")
    expect(screen.getByText("Operação")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })
})

describe("PageHeader under the staff shell", () => {
  it("hides the eyebrow when the breadcrumb lives in the header", () => {
    render(
      <ShellContext.Provider value={{ breadcrumbInHeader: true }}>
        <PageHeader title="Reservas" eyebrow="Operacao" />
      </ShellContext.Provider>,
    )
    expect(screen.queryByText("Operacao")).not.toBeInTheDocument()
  })

  it("shows the eyebrow without the context", () => {
    render(<PageHeader title="Reservas" eyebrow="Operacao" />)
    expect(screen.getByText("Operacao")).toBeInTheDocument()
  })
})
