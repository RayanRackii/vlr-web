import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Page } from "@/components/layout/Page"

describe("Page", () => {
  it("renders one h1 with title, eyebrow and description", () => {
    render(
      <Page header={{ eyebrow: "Operação", title: "Agendas", description: "Tudo do dia" }}>
        <p>conteudo</p>
      </Page>,
    )

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: "Agendas" })).toBeInTheDocument()
    expect(screen.getByText("Operação")).toBeInTheDocument()
    expect(screen.getByText("Tudo do dia")).toBeInTheDocument()
    expect(screen.getByText("conteudo")).toBeInTheDocument()
  })

  it("shows the skeleton instead of children while loading", () => {
    render(
      <Page header={{ title: "Agendas" }} state="loading">
        <p>conteudo</p>
      </Page>,
    )

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByText("conteudo")).not.toBeInTheDocument()
  })

  it("shows the error and calls onRetry", () => {
    const onRetry = vi.fn()
    render(
      <Page header={{ title: "Agendas" }} state="error" error="Falhou" onRetry={onRetry}>
        <p>conteudo</p>
      </Page>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou")
    expect(screen.queryByText("conteudo")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("applies the form width and defaults to wide", () => {
    const { container, rerender } = render(
      <Page header={{ title: "A" }} width="form">x</Page>,
    )
    expect(container.firstElementChild).toHaveClass("max-w-3xl")

    rerender(<Page header={{ title: "A" }}>x</Page>)
    expect(container.firstElementChild).toHaveClass("max-w-7xl")
  })
})
