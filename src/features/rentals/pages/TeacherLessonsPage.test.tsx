import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

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

describe("TeacherLessonsPage", () => {
  beforeEach(() => {
    vi.mocked(listAdminRentalAssets).mockResolvedValue([court])
    vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
      date: "2026-10-08",
      slots: [openSlot, secondOpenSlot, lessonSlot, bookedLessonSlot, cancelledLessonSlot],
    })
    vi.mocked(createTeacherLesson).mockResolvedValue(lessonSlot)
    vi.mocked(removeTeacherLesson).mockResolvedValue(openSlot)
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
})
