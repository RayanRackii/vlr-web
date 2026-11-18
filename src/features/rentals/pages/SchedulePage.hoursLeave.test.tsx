import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom"

import { SchedulePage } from "./SchedulePage"
import i18n from "@/lib/i18n"
import {
  listAdminRentalAssets,
  listOccupancyKinds,
  type AdminRentalAsset,
  type OccupancyKind,
} from "../services/scheduleService"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({ DailyAgendaTab: () => null }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
  listScheduleTemplates: vi.fn().mockResolvedValue([]),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
  applyWeeklyRule: vi.fn().mockResolvedValue({ created: 1, updated: 0 }),
}))

const asset: AdminRentalAsset = {
  id: "room", assetId: "asset", name: "Sala 1", isActive: true, requiresDeposit: false,
  schedulePolicy: "SlotGrid", openTime: "08:00:00", closeTime: "22:00:00", allowedDurationMinutes: "60",
  unitId: "unit", type: "Location", totalQuantity: 1, queueEnabled: false, queueOpeningTime: null,
  categoryId: null, categoryName: null,
}
const kinds: OccupancyKind[] = [
  { id: "lesson", key: "lesson", label: "Aula", isActive: true, isBookableByCustomer: true, blocksCapacity: true, sortOrder: 0 },
]

function renderAgenda() {
  const router = createMemoryRouter([
    {
      path: "/configuracoes/agenda",
      element: (
        <>
          <Link to="/painel">Painel</Link>
          <SchedulePage />
        </>
      ),
    },
    { path: "/painel", element: <h1>Painel</h1> },
    { path: "/configuracoes/recursos/:id/assistente", element: <h1>Assistente</h1> },
  ], { initialEntries: ["/painel", "/configuracoes/agenda"], initialIndex: 1 })
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

function tabButton(label: string) {
  return screen.getByRole("tab", { name: label })
}

async function openSunday(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByRole("switch", { name: new RegExp(i18n.t("rentals.schedule.days.Sunday")) })
  await waitFor(() => expect(toggle).toBeEnabled())
  await user.click(toggle)
  return toggle
}

async function refuseLeave(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog")
  expect(dialog).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
  await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
}

async function acceptLeave(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog")
  await user.click(within(dialog).getByRole("button", { name: i18n.t("fullPage.leave") }))
}

describe("business hours leave guard", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset])
    vi.mocked(listOccupancyKinds).mockResolvedValue(kinds)
    window.history.pushState({}, "", "/")
  })

  it("opens on the business hours tab and switches a clean editor to Ajustar um dia without asking", async () => {
    const user = userEvent.setup()
    renderAgenda()
    expect(tabButton(i18n.t("rentals.schedule.tabs.templates"))).toHaveAttribute("aria-selected", "true")
    await openSunday(user)
    await user.click(screen.getByRole("switch", { name: new RegExp(i18n.t("rentals.schedule.days.Sunday")) }))
    await user.click(tabButton(i18n.t("rentals.schedule.tabs.daily")))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(tabButton(i18n.t("rentals.schedule.tabs.daily"))).toHaveAttribute("aria-selected", "true")
  })

  it("asks before Ajustar um dia leaves an unsaved edit and discards only on Sair", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    try {
      renderAgenda()
      const toggle = await openSunday(user)
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)
      await user.click(tabButton(i18n.t("rentals.schedule.tabs.daily")))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(tabButton(i18n.t("rentals.schedule.tabs.templates"))).toHaveAttribute("aria-selected", "true")
      expect(toggle).toBeChecked()
      await user.click(tabButton(i18n.t("rentals.schedule.tabs.daily")))
      await acceptLeave(user)
      expect(tabButton(i18n.t("rentals.schedule.tabs.daily"))).toHaveAttribute("aria-selected", "true")
      expect(screen.queryByRole("switch")).not.toBeInTheDocument()
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
    } finally {
      confirm.mockRestore()
    }
  })

  it("discards an edit from the save bar without a prompt", async () => {
    const user = userEvent.setup()
    renderAgenda()
    const toggle = await openSunday(user)
    await user.click(screen.getByRole("button", { name: i18n.t("fullPage.discard") }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(toggle).not.toBeChecked()
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
  })

  it("asks before a nav link or browser back leaves an unsaved edit", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    const { router } = renderAgenda()
    try {
      const toggle = await openSunday(user)
      await user.click(screen.getByRole("link", { name: "Painel" }))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      expect(toggle).toBeChecked()
      await act(async () => { await router.navigate(-1) })
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      await user.click(screen.getByRole("link", { name: "Painel" }))
      await acceptLeave(user)
      expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it("asks before the wizard return link leaves an unsaved edit", async () => {
    window.history.pushState({}, "", "/configuracoes/agenda?returnTo=%2Fconfiguracoes%2Frecursos%2Fabc%2Fassistente")
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    const { router } = renderAgenda()
    try {
      const toggle = await openSunday(user)
      await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      expect(toggle).toBeChecked()
      await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
      await acceptLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/recursos/abc/assistente")
    } finally {
      confirm.mockRestore()
      window.history.pushState({}, "", "/")
    }
  })

  it("keeps the old tab links working: semana is the hours tab and tipos opens the advanced sheet", async () => {
    window.history.pushState({}, "", "/configuracoes/agenda?aba=tipos")
    const user = userEvent.setup()
    renderAgenda()
    expect(screen.getByRole("tab", { name: i18n.t("rentals.schedule.tabs.templates"), hidden: true })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByText(i18n.t("rentals.schedule.kinds.description"))).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: new RegExp(i18n.t("rentals.schedule.tabs.kinds")), hidden: true })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByText(i18n.t("rentals.schedule.kinds.description"))).not.toBeInTheDocument())
  })
})
