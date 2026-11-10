import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
  const button = screen.getByText(label).closest("button")
  if (!button) throw new Error(`missing tab ${label}`)
  return button
}

async function openWeeklyRule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  const apply = await screen.findByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.apply") })
  await waitFor(() => expect(apply).toBeEnabled())
  await user.click(apply)
  return screen.getByRole("region", { name: i18n.t("rentals.schedule.weeklyRule.title") })
}

function setDuration(rule: HTMLElement, minutes: string) {
  fireEvent.change(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes")), {
    target: { value: minutes },
  })
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

describe("weekly rule leave guard", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("pt-BR")
    vi.mocked(listAdminRentalAssets).mockResolvedValue([asset])
    vi.mocked(listOccupancyKinds).mockResolvedValue(kinds)
    window.history.pushState({}, "", "/")
  })

  it("switches a clean weekly rule to Agenda do dia without asking", async () => {
    const user = userEvent.setup()
    renderAgenda()
    const rule = await openWeeklyRule(user)
    setDuration(rule, "90")
    setDuration(rule, "60")
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(tabButton(i18n.t("rentals.schedule.tabs.daily"))).toHaveAttribute("aria-pressed", "true")
  })

  it("asks before Agenda do dia leaves a duration edit and discards only on Sair", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    try {
      renderAgenda()
      const rule = await openWeeklyRule(user)
      setDuration(rule, "90")
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)
      await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(tabButton(i18n.t("rentals.schedule.tabs.templates"))).toHaveAttribute("aria-pressed", "true")
      expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(90)
      await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
      await acceptLeave(user)
      expect(tabButton(i18n.t("rentals.schedule.tabs.daily"))).toHaveAttribute("aria-pressed", "true")
      expect(screen.queryByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).not.toBeInTheDocument()
      expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
    } finally {
      confirm.mockRestore()
    }
  })

  it("discards a duration edit from the form Cancel without a second prompt", async () => {
    const user = userEvent.setup()
    renderAgenda()
    const rule = await openWeeklyRule(user)
    setDuration(rule, "90")
    await user.click(within(rule).getByRole("button", { name: i18n.t("common.cancel") }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(within(rule).queryByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.apply") }))
    expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(60)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("asks before collapsing a dirty weekly rule and keeps the duration when staying", async () => {
    const user = userEvent.setup()
    renderAgenda()
    const rule = await openWeeklyRule(user)
    setDuration(rule, "45")
    await user.click(within(rule).getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.title") }))
    await refuseLeave(user)
    expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(45)
    await user.click(within(rule).getByRole("button", { name: i18n.t("rentals.schedule.weeklyRule.title") }))
    await acceptLeave(user)
    expect(within(rule).queryByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).not.toBeInTheDocument()
  })

  it("asks before a nav link or browser back leaves a duration edit", async () => {
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    const { router } = renderAgenda()
    try {
      const rule = await openWeeklyRule(user)
      setDuration(rule, "90")
      await user.click(screen.getByRole("link", { name: "Painel" }))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(90)
      await act(async () => { await router.navigate(-1) })
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(90)
      await user.click(screen.getByRole("link", { name: "Painel" }))
      await acceptLeave(user)
      expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it("asks before the wizard return link leaves a duration edit", async () => {
    window.history.pushState({}, "", "/configuracoes/agenda?returnTo=%2Fconfiguracoes%2Frecursos%2Fabc%2Fassistente")
    const confirm = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    const { router } = renderAgenda()
    try {
      const rule = await openWeeklyRule(user)
      setDuration(rule, "30")
      await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
      expect(confirm).not.toHaveBeenCalled()
      await refuseLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/agenda")
      expect(within(rule).getByLabelText(i18n.t("rentals.schedule.policy.slotMinutes"))).toHaveValue(30)
      await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
      await acceptLeave(user)
      expect(router.state.location.pathname).toBe("/configuracoes/recursos/abc/assistente")
    } finally {
      confirm.mockRestore()
      window.history.pushState({}, "", "/")
    }
  })
})
