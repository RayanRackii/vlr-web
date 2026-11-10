import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { SchedulePage } from "./SchedulePage"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({ DailyAgendaTab: () => null }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
  listScheduleTemplates: vi.fn().mockResolvedValue([]),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
}))

function renderAgenda() {
  const router = createMemoryRouter([
    { path: "/configuracoes/agenda", element: <SchedulePage /> },
  ], { initialEntries: ["/configuracoes/agenda"] })
  return render(<RouterProvider router={router} />)
}

describe("SchedulePage occupancy kind draft", () => {
  it("opens a blank kind form after Cancel", async () => {
    const user = userEvent.setup()
    renderAgenda()
    await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("rentals.schedule.tabs.kinds")) }))
    const createName = i18n.t("rentals.schedule.kinds.saveCreate")
    const openNew = () => user.click(screen.getAllByRole("button", { name: createName })[0])
    await openNew()
    const label = screen.getByPlaceholderText(i18n.t("rentals.schedule.kinds.placeholders.label"))
    await user.type(label, "Aula extra")
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    await openNew()
    expect(screen.getByPlaceholderText(i18n.t("rentals.schedule.kinds.placeholders.label"))).toHaveValue("")
  })
})
