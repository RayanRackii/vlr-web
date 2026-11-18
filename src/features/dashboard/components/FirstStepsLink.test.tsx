import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FirstStepsLink } from "@/features/dashboard/components/FirstStepsLink"
import { getSetupStatus } from "@/features/rentals/services/setupStatusService"

vi.mock("@/features/rentals/services/setupStatusService", () => ({ getSetupStatus: vi.fn() }))

describe("FirstStepsLink", () => {
  beforeEach(() => { vi.mocked(getSetupStatus).mockReset() })

  it("shows how many steps are missing, ignoring the customer preview", async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({
      checklist: [
        { key: "company", state: "published" }, { key: "hours", state: "missing" },
        { key: "resource", state: "draft" }, { key: "preview", state: "missing" },
      ],
      resources: [],
    })
    render(<MemoryRouter><FirstStepsLink /></MemoryRouter>)
    expect(await screen.findByText("Faltam 2 passos")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Primeiros passos" })).toHaveAttribute("href", "/primeiros-passos")
  })

  it("uses the singular for one step", async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({ checklist: [{ key: "hours", state: "missing" }], resources: [] })
    render(<MemoryRouter><FirstStepsLink /></MemoryRouter>)
    expect(await screen.findByText("Falta 1 passo")).toBeInTheDocument()
  })

  it("hides the count when everything is done", async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({ checklist: [{ key: "hours", state: "published" }], resources: [] })
    render(<MemoryRouter><FirstStepsLink /></MemoryRouter>)
    await screen.findByRole("link", { name: "Primeiros passos" })
    await Promise.resolve()
    expect(screen.queryByText(/Falt/)).not.toBeInTheDocument()
  })

  it("keeps the link and hides the count when the status fails to load", async () => {
    vi.mocked(getSetupStatus).mockImplementation(async () => { throw new Error("x") })
    render(<MemoryRouter><FirstStepsLink /></MemoryRouter>)
    expect(await screen.findByRole("link", { name: "Primeiros passos" })).toBeInTheDocument()
    await Promise.resolve()
    expect(screen.queryByText(/Falt/)).not.toBeInTheDocument()
  })
})
