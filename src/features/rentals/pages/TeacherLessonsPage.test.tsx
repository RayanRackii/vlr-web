import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { resetRemovedTeacherLessonsForTests } from "@/features/rentals/hooks/useTeacherLessons"
import { TeacherLessonsPage } from "@/features/rentals/pages/TeacherLessonsPage"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import {
  createTeacherLesson,
  fetchAdminScheduleDay,
  listAdminRentalAssets,
  removeTeacherLesson,
} from "@/features/rentals/services/scheduleService"

vi.mock("@/features/rentals/services/scheduleService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/rentals/services/scheduleService")>()
  return {
    ...actual,
    createTeacherLesson: vi.fn(),
    fetchAdminScheduleDay: vi.fn(),
    listAdminRentalAssets: vi.fn(),
    removeTeacherLesson: vi.fn(),
  }
})

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const court = {
  id: "11111111-1111-1111-1111-111111111111",
  assetId: "21111111-1111-1111-1111-111111111111",
  name: "Quadra 1",
  isActive: true,
  requiresDeposit: true,
  schedulePolicy: "SlotGrid" as const,
  unitId: "31111111-1111-1111-1111-111111111111",
  type: "Location" as const,
  totalQuantity: 1,
  queueEnabled: false,
}

const openSlot = {
  id: "00000000-0000-0000-0000-000000000000",
  rentalAssetId: court.id,
  assetName: court.name,
  date: "2026-10-08",
  startTime: "10:00:00",
  endTime: "11:00:00",
  occupancyKindId: "51111111-1111-1111-1111-111111111111",
  occupancyKindKey: "open",
  occupancyKindLabel: "Disponível",
  isBookableByCustomer: true,
  status: "Available",
  isDerived: true,
  source: "WeeklyDefault" as const,
  schedulePolicy: "SlotGrid" as const,
  supportsEntireRecurrence: false,
}

const secondOpenSlot = {
  ...openSlot,
  startTime: "11:00:00",
  endTime: "12:00:00",
}

const lessonSlot = {
  ...openSlot,
  id: "61111111-1111-1111-1111-111111111111",
  startTime: "12:00:00",
  endTime: "13:00:00",
  occupancyKindKey: "lesson",
  occupancyKindLabel: "Aula",
  label: "Treino",
}
const bookedLessonSlot = { ...lessonSlot, id: "71111111-1111-1111-1111-111111111111", status: "Booked" }
const cancelledLessonSlot = { ...lessonSlot, id: "81111111-1111-1111-1111-111111111111", status: "Cancelled" }
const reservedOpenSlot = {
  ...openSlot,
  id: "91111111-1111-1111-1111-111111111111",
  startTime: "14:00:00",
  endTime: "15:00:00",
  status: "Available",
  reservationId: "a1111111-1111-1111-1111-111111111111",
}
const reservedLessonSlot = {
  ...lessonSlot,
  id: "b1111111-1111-1111-1111-111111111111",
  startTime: "15:00:00",
  endTime: "16:00:00",
  status: "Available",
  reservationId: "c1111111-1111-1111-1111-111111111111",
}

function addIsoDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function confirmLessonRemoval(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog")
  await user.click(within(dialog).getByRole("button", { name: "Confirmar remoção" }))
}

describe("TeacherLessonsPage", () => {
  beforeEach(() => {
    resetRemovedTeacherLessonsForTests()
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-08T12:00:00.000Z"),
    })
    window.history.replaceState(null, "", "/")
    vi.mocked(listAdminRentalAssets).mockResolvedValue([court])
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
      date: "2026-10-08",
      slots: [openSlot, secondOpenSlot, lessonSlot, bookedLessonSlot, cancelledLessonSlot],
    })
    vi.mocked(createTeacherLesson).mockResolvedValue(lessonSlot)
    vi.mocked(removeTeacherLesson).mockResolvedValue(openSlot)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("offers date-only lesson actions and no generic schedule administration", async () => {
    render(<TeacherLessonsPage />)

    expect(await screen.findByRole("heading", { name: "Aulas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Criar aula nesta data" })).toBeInTheDocument()
    expect(await screen.findAllByRole("button", { name: /Remover aula/ })).toHaveLength(1)
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.queryByText(/Configuração semanal|Política da agenda|Tipos de ocupação/)).not.toBeInTheDocument()
  })

  it("sets today as the earliest date and hides booked or cancelled lessons from removal", async () => {
    render(<TeacherLessonsPage />)

    const date = await screen.findByLabelText("Data")
    expect(date).toHaveAttribute("min", todayIsoDate())
    expect(await screen.findAllByRole("button", { name: /Remover aula/ })).toHaveLength(1)
  })

  it("selects the chosen derived interval even when several windows have id zero", async () => {
    const user = userEvent.setup()
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))

    await waitFor(() => expect(createTeacherLesson).toHaveBeenCalledWith({
      rentalAssetId: court.id,
      date: expect.any(String),
      startTime: secondOpenSlot.startTime,
      endTime: secondOpenSlot.endTime,
      label: null,
    }))
  })

  it("ignores a stale day response after the selected date changes", async () => {
    const user = userEvent.setup()
    const pending: Array<(value: Awaited<ReturnType<typeof fetchAdminScheduleDay>>) => void> = []
    vi.mocked(fetchAdminScheduleDay).mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
    render(<TeacherLessonsPage />)

    await waitFor(() => expect(pending).toHaveLength(1))
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-09" } })
    await waitFor(() => expect(pending).toHaveLength(2))

    await act(async () => pending[1]({ date: "2026-10-09", slots: [secondOpenSlot] }))
    await act(async () => pending[0]({ date: "2026-10-08", slots: [openSlot] }))

    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "11:00–12:00" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "10:00–11:00" })).not.toBeInTheDocument()
  })

  it("explains when a selected time disappears after the day refreshes", async () => {
    const user = userEvent.setup()
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: date === "2026-10-09" ? [openSlot] : [openSlot, secondOpenSlot],
    }))
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    expect(screen.getByRole("combobox", { name: "Horário disponível" })).toHaveTextContent("11:00–12:00")
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-09" } })
    await waitFor(() => expect(fetchAdminScheduleDay).toHaveBeenCalledWith("2026-10-09", [court.id]))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este horário não está mais disponível. Atualize a grade e escolha outro."))
    expect(screen.getByRole("button", { name: "Criar aula nesta data" })).toBeDisabled()
  })

  it("does not offer an available slot or lesson that already has a reservation", async () => {
    const user = userEvent.setup()
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
      date: todayIsoDate(),
      slots: [openSlot, reservedOpenSlot, lessonSlot, reservedLessonSlot],
    })
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "10:00–11:00" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "14:00–15:00" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover aula 12:00" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover aula 15:00" })).not.toBeInTheDocument()
  })

  it("does not toast success when create returns a slot that still has a reservation", async () => {
    const user = userEvent.setup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(createTeacherLesson).mockImplementation(async (body) => ({
      ...secondOpenSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "lesson",
      occupancyKindLabel: "Aula",
      status: "Available",
      reservationId: "d1111111-1111-1111-1111-111111111111",
    }))
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    await user.type(screen.getByLabelText("Nome da aula (opcional)"), "Treino")
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível alterar a aula. Verifique se há uma reserva ou conflito.",
    ))
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Nome da aula (opcional)")).toHaveValue("Treino")
  })

  it("does not toast success when remove returns a slot that is still a lesson", async () => {
    const user = userEvent.setup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(removeTeacherLesson).mockImplementation(async (body) => ({
      ...lessonSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "lesson",
      status: "Available",
      reservationId: null,
    }))
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("button", { name: "Remover aula 12:00" }))
    expect(removeTeacherLesson).not.toHaveBeenCalled()
    await confirmLessonRemoval(user)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível alterar a aula. Verifique se há uma reserva ou conflito.",
    ))
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover aula 12:00", hidden: true })).toBeInTheDocument()
  })

  it("toasts success only when create and remove return the expected unreserved slot", async () => {
    const user = userEvent.setup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(createTeacherLesson).mockImplementation(async (body) => ({
      ...secondOpenSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "lesson",
      occupancyKindLabel: "Aula",
      status: "Available",
      reservationId: null,
    }))
    vi.mocked(removeTeacherLesson).mockImplementation(async (body) => ({
      ...openSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "open",
      status: "Available",
      reservationId: null,
    }))
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    await user.type(screen.getByLabelText("Nome da aula (opcional)"), "Treino")
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aula criada nesta data."))
    expect(screen.getByLabelText("Nome da aula (opcional)")).toHaveValue("")

    await user.click(await screen.findByRole("button", { name: "Remover aula 12:00" }))
    await confirmLessonRemoval(user)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aula removida nesta data."))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("shows the created unbookable lesson and does not render Invalid input", async () => {
    const user = userEvent.setup()
    const closedSlot = {
      ...openSlot,
      id: "d1014191-0160-4af8-ad4a-f4e69d6091e9",
      startTime: "20:00:00",
      endTime: "21:00:00",
      occupancyKindKey: "closed",
      occupancyKindLabel: "Closed",
      isBookableByCustomer: false,
      label: "Reserva manual (M6)",
      isDerived: false,
      source: "DailyOverride" as const,
      sourceTemplateId: null,
    }
    vi.mocked(createTeacherLesson).mockImplementation(async (body) => ({
      ...secondOpenSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
      occupancyKindKey: "lesson",
      occupancyKindLabel: "Lesson",
      isBookableByCustomer: false,
      label: "Aula teste Bot4",
      status: "Available",
      reservationId: null,
      isDerived: false,
      source: "DailyOverride" as const,
    }))
    let fetches = 0
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => {
      fetches += 1
      if (fetches === 1) {
        return { date, slots: [openSlot, secondOpenSlot, closedSlot] }
      }
      return {
        date,
        slots: [
          openSlot,
          {
            ...secondOpenSlot,
            id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
            occupancyKindKey: "lesson",
            occupancyKindLabel: "Lesson",
            isBookableByCustomer: false,
            label: "Aula teste Bot4",
            status: "Available",
            reservationId: null,
            isDerived: false,
            source: "DailyOverride" as const,
          },
          closedSlot,
        ],
      }
    })
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "11:00–12:00" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "20:00–21:00" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("option", { name: "11:00–12:00" }))
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aula criada nesta data."))
    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover aula 11:00" })).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "10:00–11:00" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "11:00–12:00" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "20:00–21:00" })).not.toBeInTheDocument()
  })

  it("keeps the created lesson when the day refresh fails", async () => {
    const user = userEvent.setup()
    vi.mocked(createTeacherLesson).mockImplementation(async (body) => ({
      ...secondOpenSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
      occupancyKindKey: "lesson",
      occupancyKindLabel: "Lesson",
      isBookableByCustomer: false,
      label: "Aula teste Bot4",
      status: "Available",
      reservationId: null,
    }))
    let fetches = 0
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => {
      fetches += 1
      if (fetches > 1) throw new Error("network")
      return { date, slots: [openSlot, secondOpenSlot] }
    })
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))

    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("network"))
    expect(screen.getByRole("button", { name: "Remover aula 11:00" })).toBeInTheDocument()
  })

  it("keeps the created lesson when a later read still returns the open interval", async () => {
    const user = userEvent.setup()
    vi.mocked(createTeacherLesson).mockImplementation(async (body) => ({
      ...secondOpenSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
      occupancyKindKey: "lesson",
      occupancyKindLabel: "Lesson",
      isBookableByCustomer: false,
      label: "Aula teste Bot4",
      status: "Available",
      reservationId: null,
    }))
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: [openSlot, secondOpenSlot],
    }))
    render(<TeacherLessonsPage />)

    await user.click(await screen.findByRole("combobox", { name: "Horário disponível" }))
    await user.click(await screen.findByRole("option", { name: "11:00–12:00" }))
    await user.click(screen.getByRole("button", { name: "Criar aula nesta data" }))

    await waitFor(() => expect(vi.mocked(fetchAdminScheduleDay).mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "10:00–11:00" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "11:00–12:00" })).not.toBeInTheDocument()
  })

  it("hides times that already started today on the tenant clock", async () => {
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"))
    const today = "2026-10-15"
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
      date: today,
      slots: [
        { ...openSlot, date: today, startTime: "08:00:00", endTime: "09:00:00" },
        { ...openSlot, date: today, startTime: "13:00:00", endTime: "14:00:00" },
        {
          ...lessonSlot,
          date: today,
          startTime: "09:00:00",
          endTime: "10:00:00",
        },
      ],
    })
    const user = userEvent.setup()
    render(<TeacherLessonsPage />)

    expect(
      await screen.findByText("Horários que já começaram hoje ficam ocultos."),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Remover aula 09:00" }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(
      await screen.findByRole("option", { name: "13:00–14:00" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "08:00–09:00" }),
    ).not.toBeInTheDocument()

    await user.keyboard("{Escape}")
    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-10-16" },
    })
    await waitFor(() => {
      expect(fetchAdminScheduleDay).toHaveBeenCalledWith("2026-10-16", [court.id])
    })
    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(
      await screen.findByRole("option", { name: "08:00–09:00" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Horários que já começaram hoje ficam ocultos."),
    ).not.toBeInTheDocument()
  })

  it("explains when a past date query is shown as today", async () => {
    window.history.replaceState(null, "", "/configuracoes/agenda?date=2000-01-01")
    render(<TeacherLessonsPage />)

    expect(
      await screen.findByText(
        "A data do link já passou. Os horários abaixo são de hoje.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toHaveValue(todayIsoDate())
    await waitFor(() => {
      expect(fetchAdminScheduleDay).toHaveBeenCalledWith(todayIsoDate(), [court.id])
    })
    expect(fetchAdminScheduleDay).not.toHaveBeenCalledWith(
      "2000-01-01",
      expect.anything(),
    )
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
  })

  it("reloads the lesson for the date stored in the query string", async () => {
    const lessonDate = addIsoDays(todayIsoDate(), 1)
    const lesson = {
      ...lessonSlot,
      date: lessonDate,
      startTime: "15:00:00",
      endTime: "16:00:00",
      id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
      occupancyKindKey: "lesson",
      isBookableByCustomer: false,
      label: "Aula teste Bot4",
      status: "Available",
      reservationId: null,
    }
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: date === lessonDate ? [lesson] : [],
    }))
    window.history.replaceState(null, "", `/configuracoes/agenda?date=${lessonDate}`)

    const first = render(<TeacherLessonsPage />)
    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toHaveValue(lessonDate)
    expect(fetchAdminScheduleDay).toHaveBeenCalledWith(lessonDate, [court.id])
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()

    first.unmount()
    window.history.replaceState(null, "", `/configuracoes/agenda?date=${lessonDate}`)
    render(<TeacherLessonsPage />)
    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.getByLabelText("Data")).toHaveValue(lessonDate)
  })

  it("does not show an empty lesson list while the initial day read is still in flight", async () => {
    const lessonDate = addIsoDays(todayIsoDate(), 1)
    const lesson = {
      ...lessonSlot,
      date: lessonDate,
      startTime: "15:00:00",
      endTime: "16:00:00",
      id: "e295e5f4-c8bf-48ae-96b3-7210d4b3138f",
      occupancyKindKey: "lesson",
      isBookableByCustomer: false,
      label: "Aula teste Bot4",
      status: "Available",
      reservationId: null,
    }
    let resolveDay: (value: { date: string; slots: typeof lesson[] }) => void = () => undefined
    const pendingDay = new Promise<{ date: string; slots: typeof lesson[] }>((resolve) => {
      resolveDay = resolve
    })
    vi.mocked(fetchAdminScheduleDay).mockReturnValue(pendingDay)
    window.history.replaceState(null, "", `/configuracoes/agenda?date=${lessonDate}`)

    render(<TeacherLessonsPage />)

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Quadra" })).toHaveTextContent("Quadra 1")
      expect(fetchAdminScheduleDay).toHaveBeenCalledWith(lessonDate, [court.id])
    })
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()
    expect(screen.getByText("Carregando as aulas desta data.")).toBeInTheDocument()
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Carregando os horários deste recurso.",
    )

    await act(async () => {
      resolveDay({ date: lessonDate, slots: [lesson] })
    })

    expect(await screen.findByText("Aula teste Bot4")).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma aula nesta data.")).not.toBeInTheDocument()
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Não há horário aberto nesta data.",
    )
  })

  it("selects the first resource before lessons finish loading", async () => {
    let resolveAssets: (value: typeof court[]) => void = () => undefined
    const pendingAssets = new Promise<(typeof court)[]>((resolve) => {
      resolveAssets = resolve
    })
    let resolveDay: (value: { date: string; slots: typeof lessonSlot[] }) => void = () => undefined
    const pendingDay = new Promise<{ date: string; slots: typeof lessonSlot[] }>((resolve) => {
      resolveDay = resolve
    })
    vi.mocked(listAdminRentalAssets).mockReturnValue(pendingAssets)
    vi.mocked(fetchAdminScheduleDay).mockReturnValue(pendingDay)

    render(<TeacherLessonsPage />)

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carregando os espaços...",
    )
    expect(screen.queryByText("Carregando as aulas desta data.")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Quadra" })).toBeDisabled()

    await act(async () => {
      resolveAssets([court])
    })

    await waitFor(() => {
      const resource = screen.getByRole("combobox", { name: "Quadra" })
      expect(resource).toHaveTextContent("Quadra 1")
      expect(resource).toBeEnabled()
    })
    expect(screen.getByText("Carregando as aulas desta data.")).toBeInTheDocument()
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Carregando os horários deste recurso.",
    )

    await act(async () => {
      resolveDay({ date: todayIsoDate(), slots: [lessonSlot] })
    })

    expect(await screen.findByText("Treino")).toBeInTheDocument()
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Não há horário aberto nesta data.",
    )
    expect(screen.getByRole("combobox", { name: "Quadra" })).toHaveTextContent("Quadra 1")
  })

  it("lists the freed time in start order after a lesson is removed", async () => {
    const user = userEvent.setup()
    const slot10 = { ...openSlot, startTime: "10:00:00", endTime: "11:00:00" }
    const slot14 = {
      ...openSlot,
      id: "91111111-1111-1111-1111-111111111112",
      startTime: "14:00:00",
      endTime: "15:00:00",
      reservationId: null,
    }
    const lesson12 = { ...lessonSlot, startTime: "12:00:00", endTime: "13:00:00" }
    let reads = 0
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => {
      reads += 1
      if (reads === 1) return { date, slots: [slot10, slot14, lesson12] }
      return { date, slots: [slot10, slot14] }
    })
    vi.mocked(removeTeacherLesson).mockImplementation(async (body) => ({
      ...openSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "open",
      status: "Available",
      reservationId: null,
    }))
    render(<TeacherLessonsPage />)

    await screen.findByRole("button", { name: "Remover aula 12:00" })
    const callsBeforeRemoval = vi.mocked(fetchAdminScheduleDay).mock.calls.length
    await user.click(screen.getByRole("button", { name: "Remover aula 12:00" }))
    await confirmLessonRemoval(user)
    await waitFor(() => expect(vi.mocked(fetchAdminScheduleDay).mock.calls.length).toBe(callsBeforeRemoval + 1))

    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "10:00–11:00",
      "12:00–13:00",
      "14:00–15:00",
    ])
  })

  it("does not show a removed lesson again when a later read still lists it", async () => {
    const user = userEvent.setup()
    vi.mocked(removeTeacherLesson).mockImplementation(async (body) => ({
      ...openSlot,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      occupancyKindKey: "open",
      status: "Available",
      reservationId: null,
    }))
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: [openSlot, secondOpenSlot, { ...lessonSlot, date }],
    }))

    const first = render(<TeacherLessonsPage />)
    await user.click(await screen.findByRole("button", { name: "Remover aula 12:00" }))
    await confirmLessonRemoval(user)
    expect(await screen.findByText("Nenhuma aula nesta data.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover aula 12:00" })).not.toBeInTheDocument()

    first.unmount()
    render(<TeacherLessonsPage />)
    expect(await screen.findByText("Nenhuma aula nesta data.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover aula 12:00" })).not.toBeInTheDocument()
  })

  it("explains Saturday with no slots as missing hours and still requests that civil date", async () => {
    const user = userEvent.setup()
    const secondCourt = {
      ...court,
      id: "22222222-2222-2222-2222-222222222222",
      name: "Quadra 2",
    }
    vi.mocked(listAdminRentalAssets).mockResolvedValue([court, secondCourt])
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => ({
      date,
      slots: [],
    }))
    window.history.replaceState(null, "", "/configuracoes/agenda?date=2026-10-24")

    render(<TeacherLessonsPage />)

    expect(await screen.findByTestId("available-time-state")).toHaveTextContent(
      "Nenhum horário configurado para este dia da semana.",
    )
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Configuração semanal",
    )
    expect(fetchAdminScheduleDay).toHaveBeenCalledWith("2026-10-24", [court.id])
    expect(fetchAdminScheduleDay).not.toHaveBeenCalledWith("2026-10-23", expect.anything())
    expect(fetchAdminScheduleDay).not.toHaveBeenCalledWith("2026-10-25", expect.anything())
    expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeDisabled()
    expect(screen.queryByRole("option", { name: "10:00–11:00" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Quadra" }))
    await user.click(await screen.findByRole("option", { name: "Quadra 2" }))

    await waitFor(() => {
      expect(fetchAdminScheduleDay).toHaveBeenCalledWith("2026-10-24", [secondCourt.id])
    })
    expect(screen.getByTestId("available-time-state")).toHaveTextContent(
      "Nenhum horário configurado para este dia da semana.",
    )
  })

  it("explains a Saturday whose intervals are all closed", async () => {
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
      date: "2026-10-24",
      slots: [
        {
          ...openSlot,
          date: "2026-10-24",
          occupancyKindKey: "closed",
          occupancyKindLabel: "Fechado",
          isBookableByCustomer: false,
        },
      ],
    })
    window.history.replaceState(null, "", "/configuracoes/agenda?date=2026-10-24")

    render(<TeacherLessonsPage />)

    expect(await screen.findByTestId("available-time-state")).toHaveTextContent(
      "Este recurso está fechado nesta data.",
    )
    expect(screen.getByTestId("available-time-state")).not.toHaveTextContent(
      "Nenhum horário configurado",
    )
    expect(fetchAdminScheduleDay).toHaveBeenCalledWith("2026-10-24", [court.id])
    expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeDisabled()
  })

  it("shows an error and retries the day request", async () => {
    const user = userEvent.setup()
    const callsAtStart = vi.mocked(fetchAdminScheduleDay).mock.calls.length
    vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date) => {
      const index = vi.mocked(fetchAdminScheduleDay).mock.calls.length - callsAtStart
      if (index === 1) {
        throw new Error("network")
      }
      return {
        date,
        slots: [{ ...openSlot, date }],
      }
    })
    window.history.replaceState(null, "", "/configuracoes/agenda?date=2026-10-24")

    render(<TeacherLessonsPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os horários deste recurso.",
    )
    expect(screen.queryByText("Selecione um horário")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeDisabled()

    const callsBeforeRetry = vi.mocked(fetchAdminScheduleDay).mock.calls.length
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => {
      expect(vi.mocked(fetchAdminScheduleDay).mock.calls.length).toBe(callsBeforeRetry + 1)
      expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeEnabled()
    })
    expect(fetchAdminScheduleDay).toHaveBeenLastCalledWith("2026-10-24", [court.id])
    await user.click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "10:00–11:00" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("names loading on the available time field while the day is still in flight", async () => {
    let resolveDay: (value: { date: string; slots: typeof openSlot[] }) => void = () => undefined
    vi.mocked(fetchAdminScheduleDay).mockReturnValue(
      new Promise((resolve) => {
        resolveDay = resolve
      }),
    )
    window.history.replaceState(null, "", "/configuracoes/agenda?date=2026-10-24")

    render(<TeacherLessonsPage />)

    expect(await screen.findByTestId("available-time-state")).toHaveTextContent(
      "Carregando os horários deste recurso.",
    )
    expect(screen.queryByText("Selecione um horário")).not.toBeInTheDocument()
    expect(screen.queryByText("Nenhum horário configurado para este dia da semana.")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeDisabled()

    await act(async () => {
      resolveDay({
        date: "2026-10-24",
        slots: [{ ...openSlot, date: "2026-10-24" }],
      })
    })

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Horário disponível" })).toBeEnabled()
    })
    await userEvent.setup().click(screen.getByRole("combobox", { name: "Horário disponível" }))
    expect(await screen.findByRole("option", { name: "10:00–11:00" })).toBeInTheDocument()
    expect(screen.queryByTestId("available-time-state")).not.toBeInTheDocument()
  })
})
