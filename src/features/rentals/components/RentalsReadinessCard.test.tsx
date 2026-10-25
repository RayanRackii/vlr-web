import { render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/rentals/services/rentalsReadinessService", () => ({
  getRentalsReadiness: vi.fn(),
}))

vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn(),
}))

import { RentalsReadinessCard } from "@/features/rentals/components/RentalsReadinessCard"
import { getRentalsReadiness } from "@/features/rentals/services/rentalsReadinessService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"

const getReadiness = vi.mocked(getRentalsReadiness)
const listAssets = vi.mocked(listAdminRentalAssets)

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
    listAssets.mockReset()
    listAssets.mockResolvedValue([])
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

  it("announces each setup item's completion status to assistive technology", async () => {
    getReadiness.mockResolvedValue({
      ready: false,
      items: [
        { key: "hasUnits", done: true, count: 1 },
        { key: "hasRentableAssets", done: false, count: 0 },
      ],
    })

    renderCard()

    const completedItem = (await screen.findByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasUnits") })).closest("li")
    const pendingItem = screen.getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasRentableAssets") }).closest("li")

    expect(completedItem).not.toBeNull()
    expect(pendingItem).not.toBeNull()
    expect(within(completedItem!).getByText(i18n.t("dashboard.rentalsReadiness.status.done"))).toBeInTheDocument()
    expect(within(pendingItem!).getByText(i18n.t("dashboard.rentalsReadiness.status.pending"))).toBeInTheDocument()
  })

  it("keeps the schedule count for tenants that use the slot grid", async () => {
    getReadiness.mockResolvedValue({
      ready: false,
      items: [
        { key: "hasScheduleTemplateOrRule", done: false, count: 0 },
        { key: "hasUnits", done: false, count: 0 },
      ],
    })
    listAssets.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Resource",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "SlotGrid",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
      },
    ])

    renderCard()

    const scheduleItem = (
      await screen.findByRole("link", {
        name: i18n.t("dashboard.rentalsReadiness.items.hasScheduleTemplateOrRule"),
      })
    ).closest("li")
    const unitsItem = screen
      .getByRole("link", { name: i18n.t("dashboard.rentalsReadiness.items.hasUnits") })
      .closest("li")

    expect(within(scheduleItem!).getByText("(0)")).toBeInTheDocument()
    expect(within(unitsItem!).getByText("(0)")).toBeInTheDocument()
  })

  it("hides the schedule count when every resource uses OpenHours", async () => {
    getReadiness.mockResolvedValue({
      ready: false,
      items: [{ key: "hasScheduleTemplateOrRule", done: false, count: 0 }],
    })
    listAssets.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Resource",
        isActive: true,
        requiresDeposit: true,
        schedulePolicy: "OpenHours",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "Location",
        totalQuantity: 1,
        queueEnabled: false,
      },
    ])

    renderCard()

    const scheduleItem = (
      await screen.findByRole("link", {
        name: i18n.t("dashboard.rentalsReadiness.items.hasScheduleTemplateOrRule"),
      })
    ).closest("li")

    expect(within(scheduleItem!).queryByText("(0)")).not.toBeInTheDocument()
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
