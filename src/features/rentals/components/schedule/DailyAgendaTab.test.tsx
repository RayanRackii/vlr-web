import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"

import { DailyAgendaTab } from "@/features/rentals/components/schedule/DailyAgendaTab"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"

function renderEmptyAgenda() {
  const router = createMemoryRouter(
    [
      {
        path: "/configuracoes/agenda",
        element: (
          <DailyAgendaTab
            assets={[]}
            selectedRentalAssetIds={[]}
            date="2026-09-04"
            day={null}
            loading={false}
            showSkeleton={false}
            busy={false}
            busyAction={null}
            busyTargetKey={null}
            readOnly={false}
            onSelectedRentalAssetIdsChange={() => undefined}
            onDateChange={() => undefined}
            onPublish={() => undefined}
            onSlotOrCellClick={() => undefined}
          />
        ),
      },
      {
        path: "/configuracoes/recursos",
        element: <p>recursos-page</p>,
      },
    ],
    { initialEntries: ["/configuracoes/agenda"] },
  )

  return render(<RouterProvider router={router} />)
}

const forbidden = /Ativos|Assets|Activos|Asset Registry|asset-registry/i

describe("DailyAgendaTab no-assets empty state", () => {
  it("does not mention Ativos in any locale copy", async () => {
    for (const language of ["pt-BR", "en", "es"] as const) {
      await i18n.changeLanguage(language)
      expect(i18n.t("rentals.schedule.noAssets")).not.toMatch(forbidden)
      expect(i18n.t("rentals.schedule.noAssetsDescription")).not.toMatch(
        forbidden,
      )
      expect(i18n.t("rentals.schedule.noAssetsAction")).not.toMatch(forbidden)
    }
    await i18n.changeLanguage("pt-BR")
  })

  it("offers a CTA to /configuracoes/recursos", async () => {
    await i18n.changeLanguage("pt-BR")
    const user = userEvent.setup()
    renderEmptyAgenda()

    expect(screen.getByText(i18n.t("rentals.schedule.noAssets"))).toBeInTheDocument()
    expect(screen.queryByText(/Ativos/)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("rentals.schedule.noAssetsAction"),
      }),
    )
    expect(await screen.findByText("recursos-page")).toBeInTheDocument()
  })
})

const ASSET_ID = "11111111-1111-4111-8111-111111111111"

function agendaAsset(): AdminRentalAsset {
  return {
    id: ASSET_ID,
    assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    name: "Sala 1",
    isActive: true,
    requiresDeposit: false,
    schedulePolicy: "SlotGrid",
    openTime: "08:00:00",
    closeTime: "14:00:00",
    allowedDurationMinutes: "60",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    type: "Location",
    totalQuantity: 1,
    queueEnabled: false,
    queueOpeningTime: null,
    categoryId: null,
    categoryName: null,
  }
}

function agendaDay(date: string): AdminDaySchedule {
  const slot = (id: string, startTime: string, endTime: string) => ({
    id,
    rentalAssetId: ASSET_ID,
    assetName: "Sala 1",
    date,
    startTime,
    endTime,
    occupancyKindId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    occupancyKindKey: "open",
    occupancyKindLabel: "Aberto",
    isBookableByCustomer: true,
    label: null,
    status: "Available",
    reservationId: null,
    isDerived: false,
    source: "WeeklyDefault" as const,
    schedulePolicy: "SlotGrid" as const,
    supportsEntireRecurrence: false,
  })

  return {
    date,
    slots: [
      slot("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1", "08:00:00", "09:00:00"),
      slot("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2", "13:00:00", "14:00:00"),
    ],
  }
}

function renderDay(date: string, day: AdminDaySchedule = agendaDay(date)) {
  return render(
    <MemoryRouter>
      <DailyAgendaTab
        assets={[agendaAsset()]}
        selectedRentalAssetIds={[ASSET_ID]}
        date={date}
        day={day}
        loading={false}
        showSkeleton={false}
        busy={false}
        busyAction={null}
        busyTargetKey={null}
        readOnly={false}
        onSelectedRentalAssetIdsChange={() => undefined}
        onDateChange={() => undefined}
        onPublish={() => undefined}
        onSlotOrCellClick={() => undefined}
      />
    </MemoryRouter>,
  )
}

describe("DailyAgendaTab past starts", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not offer a start that already passed today", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"))
    renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Aberto, Indisponível",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Aberto, Disponível",
      }),
    ).toBeEnabled()
  })

  it("closes a start that passes while the day stays open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Aberto, Indisponível",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Aberto, Disponível",
      }),
    ).toBeEnabled()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Aberto, Indisponível",
      }),
    ).toBeDisabled()
  })

  it("keeps a past booked start enabled", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"))
    const day = agendaDay("2026-10-16")
    const morning = day.slots[0]
    if (!morning) {
      throw new Error("missing morning slot")
    }
    day.slots[0] = {
      ...morning,
      status: "Booked",
      reservationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    }
    renderDay("2026-10-16", day)

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Aberto, Reservado",
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Aberto, Disponível",
      }),
    ).toBeEnabled()
  })

  it("still offers a morning start on a later date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"))
    renderDay("2026-10-17")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Aberto, Disponível",
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Aberto, Disponível",
      }),
    ).toBeEnabled()
  })
})
