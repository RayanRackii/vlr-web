export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"

export const DAYS: readonly DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export const WEEKDAYS: readonly DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
]

export type PricingPattern = "sameEveryDay" | "weekendSpecial" | "perDay"

export type PricingEditorState = {
  pattern: PricingPattern
  startTime: string
  endTime: string
  everydayPrice: number
  weekdayPrice: number
  weekendPrice: number
  perDayPrices: Record<DayOfWeek, number>
}

export type ExpandedPricingRow = {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  pricePerHour: number
}

function emptyPerDayPrices(): Record<DayOfWeek, number> {
  return {
    Sunday: 0,
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
  }
}

export function emptyPricingEditor(): PricingEditorState {
  return {
    pattern: "sameEveryDay",
    startTime: "08:00",
    endTime: "22:00",
    everydayPrice: 0,
    weekdayPrice: 0,
    weekendPrice: 0,
    perDayPrices: emptyPerDayPrices(),
  }
}

export function isWeekendDay(day: DayOfWeek): boolean {
  return day === "Saturday" || day === "Sunday"
}

export function isValidPricingWindow(startTime: string, endTime: string): boolean {
  return startTime.length >= 4 && endTime.length >= 4 && startTime < endTime
}

function clock(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

function pricesMatch(
  rows: readonly ExpandedPricingRow[],
  days: readonly DayOfWeek[],
): number | null {
  const selected = days
    .map((day) => rows.find((row) => row.dayOfWeek === day))
    .filter((row): row is ExpandedPricingRow => row != null)
  if (selected.length !== days.length) {
    return null
  }
  const price = selected[0]?.pricePerHour
  if (price == null) {
    return null
  }
  return selected.every((row) => row.pricePerHour === price) ? price : null
}

export function inferPricingPattern(
  rows: readonly ExpandedPricingRow[],
): PricingPattern {
  if (rows.length === 0) {
    return "sameEveryDay"
  }

  const start = clock(rows[0]?.startTime ?? "")
  const end = clock(rows[0]?.endTime ?? "")
  const sameWindow = rows.every(
    (row) => clock(row.startTime) === start && clock(row.endTime) === end,
  )
  if (!sameWindow) {
    return "perDay"
  }

  const everyday = pricesMatch(rows, DAYS)
  if (rows.length === DAYS.length && everyday != null) {
    return "sameEveryDay"
  }

  const weekday = pricesMatch(rows, WEEKDAYS)
  const weekend = pricesMatch(rows, ["Saturday", "Sunday"])
  if (weekday != null && weekend != null) {
    return weekday === weekend ? "sameEveryDay" : "weekendSpecial"
  }

  return "perDay"
}

export function pricingEditorFromRows(
  rows: readonly ExpandedPricingRow[],
): PricingEditorState {
  const base = emptyPricingEditor()
  if (rows.length === 0) {
    return base
  }

  const startTime = clock(rows[0]?.startTime ?? base.startTime)
  const endTime = clock(rows[0]?.endTime ?? base.endTime)
  const perDayPrices = emptyPerDayPrices()
  for (const row of rows) {
    perDayPrices[row.dayOfWeek] = row.pricePerHour
  }

  const pattern = inferPricingPattern(rows)
  const everydayPrice = pricesMatch(rows, DAYS) ?? rows[0]?.pricePerHour ?? 0
  const weekdayPrice = pricesMatch(rows, WEEKDAYS) ?? everydayPrice
  const weekendPrice =
    pricesMatch(rows, ["Saturday", "Sunday"]) ?? everydayPrice

  return {
    pattern,
    startTime,
    endTime,
    everydayPrice,
    weekdayPrice,
    weekendPrice,
    perDayPrices,
  }
}

export function expandPricingEditor(
  state: PricingEditorState,
): ExpandedPricingRow[] {
  if (state.pattern === "sameEveryDay") {
    return DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: state.startTime,
      endTime: state.endTime,
      pricePerHour: state.everydayPrice,
    }))
  }

  if (state.pattern === "weekendSpecial") {
    return DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: state.startTime,
      endTime: state.endTime,
      pricePerHour: isWeekendDay(dayOfWeek)
        ? state.weekendPrice
        : state.weekdayPrice,
    }))
  }

  return DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    startTime: state.startTime,
    endTime: state.endTime,
    pricePerHour: state.perDayPrices[dayOfWeek],
  }))
}

export function isPricingEditorValid(state: PricingEditorState): boolean {
  if (!isValidPricingWindow(state.startTime, state.endTime)) {
    return false
  }

  if (state.pattern === "sameEveryDay") {
    return Number.isFinite(state.everydayPrice) && state.everydayPrice >= 0
  }

  if (state.pattern === "weekendSpecial") {
    return (
      Number.isFinite(state.weekdayPrice) &&
      state.weekdayPrice >= 0 &&
      Number.isFinite(state.weekendPrice) &&
      state.weekendPrice >= 0
    )
  }

  return DAYS.some(
    (day) =>
      Number.isFinite(state.perDayPrices[day]) &&
      state.perDayPrices[day] >= 0,
  )
}
