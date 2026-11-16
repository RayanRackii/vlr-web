import { minutes } from "./blockPeriod"

const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`

/** End of a new reservation: the resource's first allowed duration when it declares one, else one hour. */
export function defaultEnd(start: string, allowedDurationMinutes?: string | null) {
  const declared = Number.parseInt(allowedDurationMinutes?.split(",")[0]?.trim() ?? "", 10)
  const length = Number.isFinite(declared) && declared > 0 ? declared : 60
  return clock(Math.min(minutes(start) + length, 24 * 60 - 1))
}
