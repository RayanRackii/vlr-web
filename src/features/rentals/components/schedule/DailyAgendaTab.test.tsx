import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"

import { DailyAgendaTab } from "@/features/rentals/components/schedule/DailyAgendaTab"
import i18n from "@/lib/i18n"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"

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
        name: "Sala 1, 08:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()
  })

  it("closes a start when the window regains focus or the tab becomes visible", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    const view = renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()

    act(() => {
      vi.setSystemTime(new Date("2026-10-16T16:00:00.000Z"))
      window.dispatchEvent(new Event("focus"))
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()

    view.unmount()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()

    act(() => {
      vi.setSystemTime(new Date("2026-10-16T16:00:00.000Z"))
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
  })

  it("closes a start that passes while the day stays open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Indisponível, Tipo: Aberto",
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
        name: "Sala 1, 08:00, Reservado, Tipo: Aberto",
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()
  })

  it("still offers a morning start on a later date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"))
    renderDay("2026-10-17")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00, Disponível, Tipo: Aberto",
      }),
    ).toBeEnabled()
  })
})

describe("DailyAgendaTab occupancy labels", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it.each([
    ["pt-BR", "Aberto", "Tipo: Aberto"],
    ["en", "Open", "Type: Open"],
    ["es", "Abierto", "Tipo: Abierto"],
  ])("localizes the stock open kind in %s and labels it as a type", async (language, expectedName, expectedType) => {
    await i18n.changeLanguage(language)
    const day = agendaDay("2026-10-17")
    const morning = day.slots[0]
    if (!morning) throw new Error("missing morning slot")
    day.slots[0] = { ...morning, occupancyKindKey: "open", occupancyKindLabel: "Open", status: "Cancelled" }

    renderDay("2026-10-17", day)

    const typeNodes = await screen.findAllByText(expectedType)
    expect(typeNodes.some((node) => node.textContent?.includes(expectedName))).toBe(true)
    const grid = screen.getByRole("grid")
    expect(
      within(grid).getByText(i18n.t("rentals.schedule.occurrence.status.unavailable")),
    ).toHaveClass("font-semibold")
  })

  it("keeps a customized occupancy kind name", async () => {
    const day = agendaDay("2026-10-17")
    const morning = day.slots[0]
    if (!morning) throw new Error("missing morning slot")
    day.slots[0] = { ...morning, occupancyKindLabel: "Aula aberta" }

    renderDay("2026-10-17", day)

    expect(await screen.findByText("Tipo: Aula aberta")).toBeInTheDocument()
  })

  it("does not translate a custom kind that happens to be named Open", async () => {
    const day = agendaDay("2026-10-17")
    const morning = day.slots[0]
    if (!morning) throw new Error("missing morning slot")
    day.slots[0] = { ...morning, occupancyKindKey: "custom-open", occupancyKindLabel: "Open" }

    renderDay("2026-10-17", day)

    expect(await screen.findByText("Tipo: Open")).toBeInTheDocument()
  })
})

describe("DailyAgendaTab OpenHours overlapping windows", () => {
  function openHoursAsset(): AdminRentalAsset {
    return {
      ...agendaAsset(),
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "12:00:00",
      allowedDurationMinutes: "60,120,240",
    }
  }

  function overlappingOpenHoursDay(date: string): AdminDaySchedule {
    const slot = (
      id: string,
      startTime: string,
      endTime: string,
      extra: Partial<AdminDaySchedule["slots"][number]> = {},
    ) => ({
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
      status: "Available" as const,
      reservationId: null,
      isDerived: false,
      source: "WeeklyDefault" as const,
      schedulePolicy: "OpenHours" as const,
      supportsEntireRecurrence: false,
      ...extra,
    })

    return {
      date,
      slots: [
        // 1h windows (base duration)
        slot("1", "08:00:00", "09:00:00"),
        slot("2", "09:00:00", "10:00:00"),
        slot("3", "10:00:00", "11:00:00", {
          status: "Booked",
          reservationId: "ffffffff-ffff-4fff-8fff-fffffffffff1",
        }),
        slot("4", "11:00:00", "12:00:00"),
        // 2h windows, overlapping the 1h windows above
        slot("5", "08:00:00", "10:00:00"),
        slot("6", "10:00:00", "12:00:00", {
          status: "Booked",
          reservationId: "ffffffff-ffff-4fff-8fff-fffffffffff1",
        }),
        // 4h window, overlapping everything
        slot("7", "08:00:00", "12:00:00"),
      ],
    }
  }

  it("renders one grid row per base duration slot and a single span for a booked window", () => {
    const day = overlappingOpenHoursDay("2026-10-17")
    render(
      <MemoryRouter>
        <DailyAgendaTab
          assets={[openHoursAsset()]}
          selectedRentalAssetIds={[ASSET_ID]}
          date="2026-10-17"
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

    const grid = screen.getByRole("grid")
    expect(
      within(grid).getByRole("button", { name: "Sala 1, 08:00, Disponível, Tipo: Aberto" }),
    ).toBeInTheDocument()
    expect(
      within(grid).getByRole("button", { name: "Sala 1, 09:00, Disponível, Tipo: Aberto" }),
    ).toBeInTheDocument()

    // The 10:00-12:00 booking should render as a single two-row span, not
    // three overlapping buttons (1h+1h+2h+4h all covering that range), and the
    // 11:00 row is covered by that span rather than getting its own button.
    expect(
      within(grid).getAllByRole("button", { name: /Sala 1, 10:00,/ }),
    ).toHaveLength(1)
    expect(
      within(grid).getByRole("button", { name: "Sala 1, 10:00, Reservado, Tipo: Aberto" }),
    ).toBeInTheDocument()
  })

  it("keeps first-configured 120-minute OpenHours windows visible when 60 is also allowed", () => {
    const day = overlappingOpenHoursDay("2026-10-17")
    const first = day.slots[0]
    const second = day.slots[1]
    if (!first || !second) throw new Error("missing OpenHours windows")
    day.slots = [
      { ...first, startTime: "08:00:00", endTime: "10:00:00" },
      { ...second, startTime: "10:00:00", endTime: "12:00:00" },
    ]
    const asset = { ...openHoursAsset(), allowedDurationMinutes: "120,60" }

    render(
      <MemoryRouter>
        <DailyAgendaTab
          assets={[asset]}
          selectedRentalAssetIds={[ASSET_ID]}
          date="2026-10-17"
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

    expect(
      screen.getByRole("button", { name: "Sala 1, 08:00, Disponível, Tipo: Aberto" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sala 1, 10:00, Disponível, Tipo: Aberto" }),
    ).toBeInTheDocument()
  })
})

describe("DailyAgendaTab multi-unit resource", () => {
  function multiUnitAsset(): AdminRentalAsset {
    return {
      ...agendaAsset(),
      name: "Projetor",
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "16:00:00",
      allowedDurationMinutes: "240",
      totalQuantity: 3,
    }
  }

  function twoConcurrentBookingsDay(date: string): AdminDaySchedule {
    const slot = (reservationId: string) => ({
      id: "00000000-0000-0000-0000-000000000000",
      rentalAssetId: ASSET_ID,
      assetName: "Projetor",
      date,
      startTime: "12:00:00",
      endTime: "16:00:00",
      occupancyKindId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      occupancyKindKey: "open",
      occupancyKindLabel: "Aberto",
      isBookableByCustomer: false,
      label: null,
      status: "Booked" as const,
      reservationId,
      isDerived: true,
      source: "WeeklyDefault" as const,
      schedulePolicy: "OpenHours" as const,
      supportsEntireRecurrence: false,
    })

    return {
      date,
      slots: [slot("r1"), slot("r2")],
    }
  }

  it("collapses two concurrent bookings of a 3-unit resource into one cell with a units counter", () => {
    const date = "2026-10-17"
    render(
      <MemoryRouter>
        <DailyAgendaTab
          assets={[multiUnitAsset()]}
          selectedRentalAssetIds={[ASSET_ID]}
          date={date}
          day={twoConcurrentBookingsDay(date)}
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

    const grid = screen.getByRole("grid")
    expect(within(grid).getAllByText(/Reservado/).length).toBe(1)
    expect(within(grid).getByText("Reservado · 2 de 3")).toBeInTheDocument()
    expect(within(grid).getByText("1 livre")).toBeInTheDocument()
    expect(within(grid).getByText("12:00–16:00")).toBeInTheDocument()
  })
})
