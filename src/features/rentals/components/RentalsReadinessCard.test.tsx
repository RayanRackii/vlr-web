import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/rentals/services/rentalsReadinessService", () => ({
  getRentalsReadiness: vi.fn(),
}))

import { RentalsReadinessCard } from "@/features/rentals/components/RentalsReadinessCard"
import { getRentalsReadiness } from "@/features/rentals/services/rentalsReadinessService"

const getReadiness = vi.mocked(getRentalsReadiness)

function renderCard(options: {
  activeModules?: readonly string[]
  permissions?: readonly string[]
} = {}) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider
        activeModules={options.activeModules ?? ["rentals"]}
        permissions={options.permissions ?? ["rentals.assets.read"]}
      >
        <RentalsReadinessCard />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("RentalsReadinessCard", () => {
  beforeEach(() => {
    getReadiness.mockReset()
  })

  it("links each incomplete setup item to its configuration screen", async () => {
    getReadiness.mockResolvedValue({
      ready: false,
      items: [
        { key: "hasUnits", done: false, count: 0 },
        { key: "hasRentableAssets", done: false, count: 0 },
        { key: "hasScheduleTemplateOrRule", done: false, count: 0 },
        { key: "hasBookingPolicy", done: true },
        { key: "hasVisualOrMap", done: false, count: 0 },
      ],
    })

    renderCard()

    expect(await screen.findByRole("heading", { name: i18n.t("dashboard.rentalsReadiness.title") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasUnits") })).toHaveAttribute("href", "/configuracoes/recursos")
    expect(screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasRentableAssets") })).toHaveAttribute("href", "/configuracoes/recursos")
    expect(screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasScheduleTemplateOrRule") })).toHaveAttribute("href", "/configuracoes/agenda")
    expect(screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasBookingPolicy") })).toHaveAttribute("href", "/configuracoes/politica-reservas")
    expect(screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasVisualOrMap") })).toHaveAttribute("href", "/configuracoes/layout")
  })

  it("does not load or render without the rentals module or read permission", () => {
    renderCard({ activeModules: [] })
    expect(getReadiness).not.toHaveBeenCalled()

    renderCard({ permissions: [] })
    expect(getReadiness).not.toHaveBeenCalled()
  })

  it("hides itself when setup is ready or the endpoint fails", async () => {
    getReadiness.mockResolvedValue({ ready: true, items: [] })
    const { rerender } = renderCard()

    await waitFor(() => {
      expect(getReadiness).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("heading", { name: i18n.t("dashboard.rentalsReadiness.title") })).not.toBeInTheDocument()

    getReadiness.mockRejectedValue(new Error("Not Found"))
    rerender(<div />)
    render(
      <MemoryRouter>
        <TestPermissionProvider activeModules={["rentals"]} permissions={["rentals.assets.read"]}>
          <RentalsReadinessCard />
        </TestPermissionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getReadiness).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByRole("heading", { name: i18n.t("dashboard.rentalsReadiness.title") })).not.toBeInTheDocument()
  })
})
