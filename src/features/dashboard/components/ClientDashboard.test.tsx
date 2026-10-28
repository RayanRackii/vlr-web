import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ClientDashboard } from "./ClientDashboard"

describe("client dashboard empty states", () => {
  it("explains empty requests and rentals without offering unavailable routes", () => {
    render(<ClientDashboard />)
    expect(screen.getByText("Nenhum chamado aberto.")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma locação ativa.")).toBeInTheDocument()
    expect(screen.getAllByText("Novas atividades vinculadas ao seu cadastro aparecerão aqui.")).toHaveLength(2)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
