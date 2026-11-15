import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"

import { DayResourceGrid } from "@/features/rentals/components/schedule/DayResourceGrid"
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

/** Plain free slots are click targets, not focusable buttons (see DayResourceGrid compact). */
function freeSlot(start: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-slot-target="${ASSET_ID}|${start}:00"][data-state="available"]`,
  )
  if (!element) throw new Error(`missing free slot ${start}`)
  return element
}

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
        name: "Sala 1, 08:00–09:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")
  })

  it("closes a start when the window regains focus or the tab becomes visible", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    const view = renderDay("2026-10-16")

    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")

    act(() => {
      vi.setSystemTime(new Date("2026-10-16T16:00:00.000Z"))
      window.dispatchEvent(new Event("focus"))
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00–14:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()

    view.unmount()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    renderDay("2026-10-16")

    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")

    act(() => {
      vi.setSystemTime(new Date("2026-10-16T16:00:00.000Z"))
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00–14:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
  })

  it("closes a start that passes while the day stays open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:59:00.000Z"))
    renderDay("2026-10-16")

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00–09:00, Indisponível, Tipo: Aberto",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Sala 1, 08:00–09:00, Indisponível, Tipo: Aberto",
      }),
    ).toHaveAttribute("title", i18n.t("rentals.schedule.grid.minimumLeadTime"))
    expect(screen.getByText(i18n.t("rentals.schedule.grid.minimumLeadTime"))).toBeInTheDocument()
    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(
      screen.getByRole("button", {
        name: "Sala 1, 13:00–14:00, Indisponível, Tipo: Aberto",
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

    const bookedCard = screen.getByRole("button", {
      name: "Sala 1, 08:00–09:00, Reservado, Tipo: Aberto",
    })
    expect(bookedCard).toBeEnabled()
    // R11: booked cards show time + status, not the open-hours kind that reads like a free slot.
    expect(bookedCard).toHaveTextContent("08:00–09:00")
    expect(bookedCard).toHaveTextContent("Reservado")
    expect(bookedCard).not.toHaveTextContent("Tipo: Aberto")
    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")
  })

  it("still offers a morning start on a later date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T15:00:00.000Z"))
    renderDay("2026-10-17")

    expect(
      freeSlot("08:00")).not.toHaveClass("cursor-not-allowed")
    expect(
      freeSlot("13:00"),
    ).not.toHaveClass("cursor-not-allowed")
  })
})

describe("DailyAgendaTab occupancy labels", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it.each([
    ["pt-BR", "Aberto"],
    ["en", "Open"],
    ["es", "Abierto"],
  ])("localizes the stock open kind in %s and labels it as a type", async (language, expectedName) => {
    await i18n.changeLanguage(language)
    const day = agendaDay("2026-10-17")
    const morning = day.slots[0]
    if (!morning) throw new Error("missing morning slot")
    day.slots[0] = { ...morning, occupancyKindKey: "open", occupancyKindLabel: "Open", status: "Cancelled" }

    renderDay("2026-10-17", day)

    const grid = screen.getByRole("grid")
    // One state per slot: the stock open kind is not repeated as a second label on the card,
    // but stays localized in the accessible name.
    const card = await within(grid).findByRole("button", { name: /Sala 1, 08:00/ })
    expect(card).toHaveAccessibleName(new RegExp(`: ${expectedName}$`))
    expect(within(card).queryByText(expectedName)).not.toBeInTheDocument()
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

    expect(await screen.findByText("Aula aberta")).toBeInTheDocument()
  })

  it("does not translate a custom kind that happens to be named Open", async () => {
    const day = agendaDay("2026-10-17")
    const morning = day.slots[0]
    if (!morning) throw new Error("missing morning slot")
    day.slots[0] = { ...morning, occupancyKindKey: "custom-open", occupancyKindLabel: "Open" }

    renderDay("2026-10-17", day)

    const grid = screen.getByRole("grid")
    expect(await within(grid).findAllByText("Open")).not.toHaveLength(0)
  })
})

describe("DayResourceGrid compact slots", () => {
  it("shows a compact time range for a 30-minute slot ending at 23:59:59", () => {
    render(
      <DayResourceGrid
        assets={[{ ...agendaAsset(), openTime: "23:30:00", closeTime: "23:59:59" }]}
        occupancies={[{
          id: "short-slot",
          rentalAssetId: ASSET_ID,
          startTime: "23:30:00",
          endTime: "23:59:59",
          status: "available",
          occupancyKindKey: "open",
          occupancyKindLabel: "Aberto",
        }]}
        busyTargetKey={null}
        readOnly={false}
        onCellClick={() => undefined}
      />,
    )

    expect(screen.getByRole("button", {
      name: "Sala 1, 23:30–00:00, Disponível, Tipo: Aberto",
    })).toHaveTextContent("23:30–00:00")
  })
})

describe("DayResourceGrid tablet reflow", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([393, 767, 1024, 1440])("keeps a single grid outside tablet widths at %ipx", (width) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: width >= 768 && width <= 1023,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    const assets = Array.from({ length: 4 }, (_, index) => ({
      ...agendaAsset(), id: `resource-${index}`, name: `Sala ${index + 1}`,
    }))
    render(<DayResourceGrid assets={assets} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)
    expect(screen.getAllByRole("grid")).toHaveLength(1)
    expect(screen.getAllByRole("columnheader")).toHaveLength(5)
  })

  it("restores the desktop grid when the viewport leaves the tablet range", () => {
    const listeners = new Set<() => void>()
    const media = {
      matches: true,
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    }
    vi.stubGlobal("matchMedia", vi.fn(() => media))
    const assets = Array.from({ length: 3 }, (_, index) => ({
      ...agendaAsset(), id: `resource-${index}`, name: `Sala ${index + 1}`,
    }))
    const { unmount } = render(<DayResourceGrid assets={assets} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)
    expect(screen.getAllByRole("grid")).toHaveLength(2)
    act(() => {
      media.matches = false
      listeners.forEach((listener) => listener())
    })
    expect(screen.getAllByRole("grid")).toHaveLength(1)
    expect(screen.getAllByRole("columnheader")).toHaveLength(4)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it.each([768, 820, 1023])("wraps four resources into pairs at %ipx and preserves cell actions", async (width) => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(min-width: 768px) and (max-width: 1023px)" && width >= 768 && width <= 1023,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    const assets = Array.from({ length: 4 }, (_, index) => ({
      ...agendaAsset(), id: `resource-${index}`, name: `Sala ${index + 1}`,
    }))
    render(<DayResourceGrid assets={assets} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={onCellClick} />)

    const grids = screen.getAllByRole("grid")
    expect(grids).toHaveLength(2)
    expect(within(grids[0]).getAllByRole("columnheader")).toHaveLength(3)
    expect(within(grids[1]).getAllByRole("columnheader")).toHaveLength(3)
    await user.click(screen.getByRole("button", { name: "Sala 4, 08:00–09:00" }))
    expect(onCellClick).toHaveBeenCalledWith(expect.objectContaining({ rentalAssetId: "resource-3", startTime: "08:00", endTime: "09:00" }))
  })
})

describe("DayResourceGrid mobile containment", () => {
  it("keeps fixed-width resource columns inside its horizontal scroller", () => {
    render(
      <DayResourceGrid
        assets={[agendaAsset(), { ...agendaAsset(), id: "11111111-1111-4111-8111-111111111112", name: "Sala 2" }]}
        occupancies={[]}
        busyTargetKey={null}
        readOnly={false}
        onCellClick={() => undefined}
      />,
    )

    const grid = screen.getByRole("grid")
    expect(grid.parentElement).toHaveClass("w-max", "min-w-full")
    expect(grid.parentElement?.parentElement).toHaveClass(
      "min-w-0",
      "overflow-x-auto",
    )
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
      freeSlot("08:00"),
    ).toBeInTheDocument()
    expect(
      freeSlot("09:00"),
    ).toBeInTheDocument()

    // The 10:00-12:00 booking should render as a single two-row span, not
    // three overlapping buttons (1h+1h+2h+4h all covering that range), and the
    // 11:00 row is covered by that span rather than getting its own button.
    expect(
      within(grid).getAllByRole("button", { name: /Sala 1, 10:00–12:00,/ }),
    ).toHaveLength(1)
    expect(
      within(grid).getByRole("button", { name: "Sala 1, 10:00–12:00, Reservado, Tipo: Aberto" }),
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
      freeSlot("08:00"),
    ).toBeInTheDocument()
    expect(
      freeSlot("10:00"),
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

  it("opens a chooser for an aggregated cell and reaches the existing details flow for the picked booking", async () => {
    const user = userEvent.setup()
    const date = "2026-10-17"
    const day = twoConcurrentBookingsDay(date)
    const onSlotOrCellClick = vi.fn()
    render(
      <MemoryRouter>
        <DailyAgendaTab
          assets={[multiUnitAsset()]}
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
          onSlotOrCellClick={onSlotOrCellClick}
        />
      </MemoryRouter>,
    )

    const grid = screen.getByRole("grid")
    await user.click(within(grid).getByRole("button", { name: /Reservado · 2 de 3/ }))

    const chooser = await screen.findByRole("dialog")
    expect(
      within(chooser).getByText(i18n.t("rentals.schedule.occurrence.unitsChooserTitle")),
    ).toBeInTheDocument()
    const entries = within(chooser).getAllByRole("button", { name: /12:00–16:00/ })
    expect(entries).toHaveLength(2)

    await user.click(entries[1] as HTMLElement)

    expect(onSlotOrCellClick).toHaveBeenCalledTimes(1)
    const payload = onSlotOrCellClick.mock.calls[0]?.[0]
    expect(payload.occupancy?.reservationId).toBe("r2")
    expect(payload.slot?.reservationId).toBe("r2")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps a lone booking on a multi-unit resource directly actionable, without a chooser", async () => {
    const user = userEvent.setup()
    const date = "2026-10-17"
    const day: AdminDaySchedule = {
      date,
      slots: [twoConcurrentBookingsDay(date).slots[0]!],
    }
    const onSlotOrCellClick = vi.fn()
    render(
      <MemoryRouter>
        <DailyAgendaTab
          assets={[multiUnitAsset()]}
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
          onSlotOrCellClick={onSlotOrCellClick}
        />
      </MemoryRouter>,
    )

    const grid = screen.getByRole("grid")
    expect(within(grid).getByText("Reservado · 1 de 3")).toBeInTheDocument()
    await user.click(within(grid).getByRole("button", { name: /Reservado · 1 de 3/ }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onSlotOrCellClick).toHaveBeenCalledTimes(1)
    const payload = onSlotOrCellClick.mock.calls[0]?.[0]
    expect(payload.occupancy?.reservationId).toBe("r1")
    expect(payload.slot?.reservationId).toBe("r1")
  })
})

describe("DayResourceGrid compact day adjust", () => {
  const free = (id: string, startTime: string, endTime: string, rentalAssetId: string) => ({
    id,
    rentalAssetId,
    startTime,
    endTime,
    status: "available" as const,
    occupancyKindKey: "open",
    occupancyKindLabel: "Aberto",
  })

  function tenAssets() {
    return Array.from({ length: 10 }, (_, index) => ({
      ...agendaAsset(),
      id: `resource-${index}`,
      name: `Sala ${index + 1}`,
      openTime: "08:00:00",
      closeTime: "20:00:00",
    }))
  }

  it("keeps free slots out of the tab order: only booked cards and one add button per resource are buttons", () => {
    const assets = tenAssets()
    const occupancies = assets.flatMap((asset) =>
      Array.from({ length: 12 }, (_, hour) =>
        free(`${asset.id}-${hour}`, `${String(8 + hour).padStart(2, "0")}:00:00`, `${String(9 + hour).padStart(2, "0")}:00:00`, asset.id),
      ),
    )
    occupancies[0] = { ...occupancies[0], status: "booked" as never }
    render(<DayResourceGrid compact assets={assets} occupancies={occupancies} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)

    const buttons = within(screen.getByRole("grid")).getAllByRole("button")
    expect(buttons).toHaveLength(11)
    expect(screen.getAllByRole("button", { name: /Adicionar horário em/ })).toHaveLength(10)
  })

  it("uses the business hours of the visible resources as the axis, with hour labels only on full hours", () => {
    render(<DayResourceGrid compact assets={[{ ...agendaAsset(), openTime: "09:00:00", closeTime: "12:00:00", allowedDurationMinutes: "30" }]} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)

    const labels = screen.getAllByRole("rowheader").map((node) => node.textContent)
    expect(labels).toEqual(["09:00", "", "10:00", "", "11:00", ""])
  })

  it("falls back to 08:00-20:00 when no resource declares hours and shows 24 hours on request", () => {
    const unknown = { ...agendaAsset(), openTime: null, closeTime: null } as unknown as AdminRentalAsset
    const view = render(<DayResourceGrid compact assets={[unknown]} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)
    const rows = screen.getAllByRole("rowheader").map((node) => node.textContent).filter(Boolean)
    expect(rows[0]).toBe("08:00")
    expect(rows[rows.length - 1]).toBe("19:00")
    view.unmount()

    render(<DayResourceGrid compact showFullDay assets={[unknown]} occupancies={[]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)
    const full = screen.getAllByRole("rowheader").map((node) => node.textContent).filter(Boolean)
    expect(full[0]).toBe("00:00")
    expect(full[full.length - 1]).toBe("23:00")
  })

  it("opens an empty cell, a free slot and the add button at the right time", async () => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    const asset = { ...agendaAsset(), allowedDurationMinutes: "60" }
    render(
      <DayResourceGrid
        compact
        assets={[asset]}
        occupancies={[free("a", "08:00:00", "09:00:00", ASSET_ID)]}
        busyTargetKey={null}
        readOnly={false}
        onCellClick={onCellClick}
      />,
    )

    await user.click(freeSlot("08:00"))
    expect(onCellClick).toHaveBeenLastCalledWith(expect.objectContaining({ startTime: "08:00:00", occupancy: expect.objectContaining({ id: "a" }) }))

    await user.click(document.querySelector(`[data-slot-target="${ASSET_ID}|10:00"]`) as HTMLElement)
    expect(onCellClick).toHaveBeenLastCalledWith(expect.objectContaining({ startTime: "10:00", endTime: "11:00", occupancy: null }))

    await user.click(screen.getByRole("button", { name: "Adicionar horário em Sala 1" }))
    expect(onCellClick).toHaveBeenLastCalledWith(expect.objectContaining({ startTime: "09:00", occupancy: null }))
  })

  it("does not open free cells that are read-only or past the minimum lead time", async () => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    render(
      <DayResourceGrid
        compact
        assets={[agendaAsset()]}
        occupancies={[free("a", "08:00:00", "09:00:00", ASSET_ID)]}
        busyTargetKey={null}
        readOnly={false}
        isStartClosed={() => true}
        onCellClick={onCellClick}
      />,
    )
    await user.click(freeSlot("08:00"))
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it("shows one state per slot and a legend with only the states on screen", () => {
    render(
      <DayResourceGrid
        compact
        assets={[agendaAsset()]}
        occupancies={[free("a", "08:00:00", "09:00:00", ASSET_ID)]}
        busyTargetKey={null}
        readOnly={false}
        onCellClick={() => undefined}
      />,
    )
    const slot = freeSlot("08:00")
    expect(slot).toHaveTextContent("08:00–09:00")
    expect(slot).not.toHaveTextContent("Aberto")
    expect(slot).not.toHaveTextContent("Disponível")
    const legend = screen.getByRole("list", { name: i18n.t("rentals.schedule.grid.legendLabel") })
    expect(within(legend).getAllByRole("listitem")).toHaveLength(1)
    expect(within(legend).getByText("Disponível")).toBeInTheDocument()
  })

  it("DailyAgendaTab toggles the 24-hour axis", async () => {
    const user = userEvent.setup()
    renderDay("2026-10-17")
    const hours = () => screen.getAllByRole("rowheader").map((node) => node.textContent).filter(Boolean)
    expect(hours()[0]).toBe("08:00")
    await user.click(screen.getByRole("checkbox", { name: "Mostrar 24 horas" }))
    expect(hours()[0]).toBe("00:00")
  })
})

describe("DayResourceGrid compact clipping", () => {
  const block = {
    id: "full-day",
    rentalAssetId: ASSET_ID,
    startTime: "00:00:00",
    endTime: "23:59:00",
    status: "unavailable" as const,
    occupancyKindKey: "closed",
    occupancyKindLabel: "Fechado",
  }
  const asset = { ...agendaAsset(), openTime: "08:00:00", closeTime: "12:00:00", allowedDurationMinutes: "60" }
  const hours = () => screen.getAllByRole("rowheader").map((node) => node.textContent).filter(Boolean)

  it("keeps the axis at business hours and draws a full-day block clipped with continues markers", () => {
    const { container } = render(<DayResourceGrid compact assets={[asset]} occupancies={[block]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)

    expect(hours()).toEqual(["08:00", "09:00", "10:00", "11:00"])
    const card = screen.getByRole("button", { name: /Sala 1, 00:00–/ })
    // 4 rows of 48px minus the 8px inset: clipped to the axis, not 24h tall.
    expect(card).toHaveStyle({ height: "184px" })
    expect(container.querySelector('[data-continues="before"]')).toBeInTheDocument()
    expect(container.querySelector('[data-continues="after"]')).toBeInTheDocument()
  })

  it("shows the whole day, without markers, when 24 hours is requested", () => {
    const { container } = render(<DayResourceGrid compact showFullDay assets={[asset]} occupancies={[block]} busyTargetKey={null} readOnly={false} onCellClick={() => undefined} />)

    const all = hours()
    expect(all[0]).toBe("00:00")
    expect(all[all.length - 1]).toBe("23:00")
    expect(container.querySelector("[data-continues]")).not.toBeInTheDocument()
  })
})
