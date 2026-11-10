import { describe, expect, it } from "vitest"
import { visibleHourLabels } from "./hourLabels"

describe("visibleHourLabels", () => {
  it("never draws 24:00 and keeps the ends of a full day", () => {
    const labels = visibleHourLabels(0, 24 * 60, 0).map((label) => label.minutes)
    expect(labels).toEqual([0, 23 * 60])
    expect(labels).not.toContain(24 * 60)
  })

  it("skips an hour that would collide with the edge label", () => {
    const labels = visibleHourLabels(0, 24 * 60, 400).map((label) => label.minutes)
    expect(labels[0]).toBe(0)
    expect(labels).not.toContain(60)
    expect(labels).not.toContain(24 * 60)
    expect(labels.at(-1)).toBe(23 * 60)
  })

  it("centers hours that fit and aligns the edges", () => {
    const labels = visibleHourLabels(6 * 60, 23 * 60, 2400)
    expect(labels.find((label) => label.minutes === 6 * 60)?.align).toBe("start")
    expect(labels.find((label) => label.minutes === 12 * 60)?.align).toBe("center")
    expect(labels.find((label) => label.minutes === 23 * 60)?.align).toBe("end")
  })
})
