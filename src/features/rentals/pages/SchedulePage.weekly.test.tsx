import type { ComponentProps } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { SchedulePage } from "./SchedulePage"
import type { WeeklyTemplatesTab } from "../components/schedule/WeeklyTemplatesTab"
import i18n from "@/lib/i18n"
import { applyWeeklyRule, listAdminRentalAssets, listOccupancyKinds, listScheduleTemplates, type AdminRentalAsset, type ScheduleTemplate } from "../services/scheduleService"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/rentals/services/scheduleService")>(),
  listAdminRentalAssets: vi.fn().mockResolvedValue([]),
  listOccupancyKinds: vi.fn().mockResolvedValue([]),
  listScheduleTemplates: vi.fn().mockResolvedValue([]),
  fetchAdminScheduleDay: vi.fn().mockResolvedValue(null),
  applyWeeklyRule: vi.fn().mockResolvedValue({ created: 1, updated: 0 }),
}))
vi.mock("@/features/rentals/components/schedule/DailyAgendaTab", () => ({ DailyAgendaTab: () => null }))
vi.mock("@/features/rentals/components/schedule/WeeklyTemplatesTab", () => ({
  WeeklyTemplatesTab: ({ weekday, onWeekdayChange, onCellClick, templateEditor, selectedRentalAssetIds, onSelectedRentalAssetIdsChange, templates, onApplyWeeklyRule, busy }: ComponentProps<typeof WeeklyTemplatesTab>) => <>
    {(["Monday", "Tuesday"] as const).map((day) => <button key={day} aria-pressed={weekday === day} onClick={() => onWeekdayChange(day)}>Grade {day}</button>)}
    {["08:00", "10:00"].map((startTime) => <button key={startTime} onClick={() => onCellClick({
      rentalAssetId: "room", assetName: "Sala", dayOfWeek: weekday, startTime,
      endTime: "11:00", origin: "empty", template: null,
    })}>{startTime}</button>)}
    <button onClick={() => onCellClick({
      rentalAssetId: "other-room", assetName: "Outra sala", dayOfWeek: "Monday", startTime: "08:00",
      endTime: "11:00", origin: "empty", template: null,
    })}>Outra sala 08:00</button>
    <output aria-label="Selected resources">{selectedRentalAssetIds.join(",")}</output>
    <button onClick={() => onSelectedRentalAssetIdsChange([...selectedRentalAssetIds])}>Same filter</button>
    <button onClick={() => onSelectedRentalAssetIdsChange(["other-room"])}>Filter other resource</button>
    <output aria-label="Weekly templates">{templates.map((template) => template.label).join(",")}</output>
    <button disabled={busy} onClick={() => { void onApplyWeeklyRule({
      rentalAssetIds: selectedRentalAssetIds, daysOfWeek: [weekday], openTime: "08:00",
      closeTime: "09:00", slotMinutes: 60, occupancyKindId: "open",
    }) }}>Apply rule</button>
    {templateEditor}
  </>,
}))

async function refuseLeave(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog")
  expect(dialog).toHaveTextContent(i18n.t("fullPage.leaveConfirm"))
  await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
}

async function acceptLeave(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog")
  await user.click(within(dialog).getByRole("button", { name: i18n.t("fullPage.leave") }))
}

it("keeps a dirty draft when weekday navigation is cancelled and discards it when confirmed", async () => {
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "Grade Monday" }))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho de segunda")
    await user.click(screen.getByRole("button", { name: "Grade Monday" }))
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Grade Tuesday" }))
    await refuseLeave(user)
    expect(screen.getByRole("button", { name: "Grade Monday" })).toHaveAttribute("aria-pressed", "true")
    expect(label()).toHaveValue("Rascunho de segunda")
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)
    await user.click(screen.getByRole("button", { name: "Grade Tuesday" }))
    await acceptLeave(user)
    expect(screen.getByRole("button", { name: "Grade Tuesday" })).toHaveAttribute("aria-pressed", "true")
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "08:00" }))
    expect(label()).toHaveValue("")
  } finally {
    confirm.mockRestore()
  }
})

it("preserves dirty weekly edits when switching is cancelled and discards only on confirmation or explicit Cancel", async () => {
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  render(<SchedulePage />)
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  await user.click(screen.getByRole("button", { name: "08:00" }))
  const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
  await user.type(label(), "Rascunho")
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(label()).toHaveValue("Rascunho")
  expect(confirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "10:00" }))
  await refuseLeave(user)
  expect(label()).toHaveValue("Rascunho")
  expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("08:00")
  await user.click(screen.getByRole("button", { name: "10:00" }))
  await acceptLeave(user)
  expect(label()).toHaveValue("")
  expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("10:00")
  await user.type(label(), "Descartar")
  await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
  expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
  confirm.mockClear()
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(label()).toHaveValue("")
  expect(confirm).not.toHaveBeenCalled()
  confirm.mockRestore()
})

it("keeps a dirty draft when leaving the weekly tab is cancelled and discards it when confirmed", async () => {
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho semanal")
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
    await refuseLeave(user)
    expect(label()).toHaveValue("Rascunho semanal")
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
    await acceptLeave(user)
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true)
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    confirm.mockClear()
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "08:00" }))
    expect(label()).toHaveValue("")
    expect(confirm).not.toHaveBeenCalled()
  } finally {
    confirm.mockRestore()
  }
})

it("resets same-time weekly drafts only after confirming a different resource and discards on explicit Cancel", async () => {
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho da sala")
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    await refuseLeave(user)
    expect(label()).toHaveValue("Rascunho da sala")
    expect(screen.getByText("Sala", { exact: true })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    await acceptLeave(user)
    expect(screen.getByText("Outra sala", { exact: true })).toBeInTheDocument()
    expect(label()).toHaveValue("")
    expect(screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.start") })).toHaveValue("08:00")

    confirm.mockClear()
    await user.type(label(), "Rascunho da outra sala")
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(label()).toHaveValue("Rascunho da outra sala")
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Outra sala 08:00" }))
    expect(label()).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "08:00" }))
    expect(label()).toHaveValue("")
    expect(screen.getByText("Sala", { exact: true })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  } finally {
    confirm.mockRestore()
  }
})

it("requests the browser reload warning only while a weekly draft is dirty and removes it on discard or unmount", async () => {
  const user = userEvent.setup()
  const reload = () => {
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  const { unmount } = render(<SchedulePage />)
  expect(reload()).toBe(false)
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(reload()).toBe(false)
  const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
  await user.type(label(), "Manter ao ficar")
  expect(reload()).toBe(true)
  expect(label()).toHaveValue("Manter ao ficar")
  await user.clear(label())
  expect(reload()).toBe(false)
  await user.type(label(), "Descartar")
  expect(reload()).toBe(true)
  await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
  expect(reload()).toBe(false)
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(label()).toHaveValue("")
  await user.type(label(), "Sair")
  expect(reload()).toBe(true)
  unmount()
  expect(reload()).toBe(false)
})

it("shows an inline occupancy-kind load error next to the weekly editor when the request fails", async () => {
  vi.mocked(listOccupancyKinds).mockRejectedValueOnce(new Error("Unavailable"))
  const user = userEvent.setup()
  render(<SchedulePage />)
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os tipos de ocupação.")
  for (const [language, message] of [
    ["pt-BR", "Não foi possível carregar os tipos de ocupação."],
    ["en", "Could not load occupancy types."],
    ["es", "No se pudieron cargar los tipos de ocupación."],
  ]) {
    expect(i18n.getResource(language, "common", "rentals.schedule.kindsLoadError")).toBe(message)
  }
  expect(screen.getByText(i18n.t("rentals.schedule.templates.kind"))).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("does not report a load error for a successfully loaded empty occupancy-kind list", async () => {
  const user = userEvent.setup()
  render(<SchedulePage />)
  await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
  await user.click(screen.getByRole("button", { name: "08:00" }))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})


it("guards a dirty template when the resource filter changes, keeping it on cancel and closing on discard", async () => {
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho do recurso")
    await user.click(screen.getByRole("button", { name: "Same filter" }))
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Filter other resource" }))
    await refuseLeave(user)
    expect(screen.getByLabelText("Selected resources")).toHaveTextContent(/^$/)
    expect(label()).toHaveValue("Rascunho do recurso")
    await user.click(screen.getByRole("button", { name: "Filter other resource" }))
    await acceptLeave(user)
    expect(screen.getByLabelText("Selected resources")).toHaveTextContent("other-room")
    expect(screen.queryByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "08:00" }))
    expect(label()).toHaveValue("")
  } finally {
    confirm.mockRestore()
  }
})

it("confirms a dirty template before the wizard return link leaves the page", async () => {
  window.history.pushState({}, "", "/configuracoes/agenda?returnTo=%2Fconfiguracoes%2Frecursos%2Fabc%2Fassistente")
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  const router = createMemoryRouter([
    { path: "/configuracoes/agenda", element: <SchedulePage /> },
    { path: "/configuracoes/recursos/:id/assistente", element: <h1>Assistente</h1> },
  ], { initialEntries: ["/configuracoes/agenda"] })
  try {
    render(<RouterProvider router={router} />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho")
    await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
    await refuseLeave(user)
    expect(confirm).not.toHaveBeenCalled()
    expect(label()).toHaveValue("Rascunho")
    expect(router.state.location.pathname).toBe("/configuracoes/agenda")
    await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
    await acceptLeave(user)
    await user.click(screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") }))
    expect(router.state.location.pathname).toBe("/configuracoes/recursos/abc/assistente")
  } finally {
    confirm.mockRestore()
    window.history.pushState({}, "", "/")
  }
})

it("leaves a dirty template in place when the wizard return link is opened in a new tab", async () => {
  window.history.pushState({}, "", "/configuracoes/agenda?returnTo=%2Fconfiguracoes%2Frecursos%2Fabc%2Fassistente")
  const confirm = vi.spyOn(window, "confirm")
  const user = userEvent.setup()
  const router = createMemoryRouter([
    { path: "/configuracoes/agenda", element: <SchedulePage /> },
    { path: "/configuracoes/recursos/:id/assistente", element: <h1>Assistente</h1> },
  ], { initialEntries: ["/configuracoes/agenda"] })
  try {
    render(<RouterProvider router={router} />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "08:00" }))
    const label = () => screen.getByRole("textbox", { name: i18n.t("rentals.schedule.templates.label") })
    await user.type(label(), "Rascunho")
    const link = screen.getByRole("link", { name: i18n.t("rentals.resourceWizard.returnToWizard") })
    fireEvent.click(link, { ctrlKey: true })
    fireEvent.click(link, { metaKey: true })
    fireEvent.click(link, { shiftKey: true })
    fireEvent.click(link, { altKey: true })
    fireEvent(link, new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }))
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))
    expect(confirm).not.toHaveBeenCalled()
    expect(label()).toHaveValue("Rascunho")
    expect(router.state.location.pathname).toBe("/configuracoes/agenda")
  } finally {
    confirm.mockRestore()
    window.history.pushState({}, "", "/")
  }
})

it("keeps weekly templates visible while applying a rule and revisiting the grid during a slow refresh", async () => {
  const asset: AdminRentalAsset = {
    id: "room", assetId: "asset", name: "Sala", isActive: true, requiresDeposit: false,
    unitId: "unit", type: "Location", totalQuantity: 1, schedulePolicy: "SlotGrid", queueEnabled: false,
  }
  const existing: ScheduleTemplate = {
    id: "template", rentalAssetId: "room", assetName: "Sala", dayOfWeek: "Monday",
    startTime: "08:00", endTime: "09:00", occupancyKindId: "open",
    occupancyKindLabel: "Disponível", label: "Horário existente", isActive: true,
  }
  vi.mocked(listAdminRentalAssets).mockResolvedValue([asset])
  vi.mocked(listScheduleTemplates).mockResolvedValue([existing])
  const user = userEvent.setup()
  let finishRefresh!: (templates: ScheduleTemplate[]) => void
  const pending = new Promise<ScheduleTemplate[]>((resolve) => { finishRefresh = resolve })
  try {
    render(<SchedulePage />)
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    await user.click(screen.getByRole("button", { name: "Grade Monday" }))
    await waitFor(() => expect(screen.getByLabelText("Weekly templates")).toHaveTextContent("Horário existente"))
    vi.mocked(listScheduleTemplates).mockReturnValue(pending)
    await user.click(screen.getByRole("button", { name: "Apply rule" }))
    await waitFor(() => expect(applyWeeklyRule).toHaveBeenCalled())
    expect(screen.getByLabelText("Weekly templates")).toHaveTextContent("Horário existente")
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.daily")))
    await user.click(screen.getByText(i18n.t("rentals.schedule.tabs.templates")))
    expect(screen.getByLabelText("Weekly templates")).toHaveTextContent("Horário existente")
    await act(async () => finishRefresh([{ ...existing, label: "Regra atualizada" }]))
    await waitFor(() => expect(screen.getByLabelText("Weekly templates")).toHaveTextContent("Regra atualizada"))
    expect(screen.getByRole("button", { name: "Apply rule" })).toBeEnabled()
  } finally {
    finishRefresh([existing])
    vi.mocked(listAdminRentalAssets).mockResolvedValue([])
    vi.mocked(listScheduleTemplates).mockResolvedValue([])
  }
})
