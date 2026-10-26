import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"

import { occupancyKindDisplayLabel } from "@/features/rentals/lib/occupancyKindLabel"

const t = ((key: string) => `T:${key}`) as unknown as TFunction

describe("occupancyKindDisplayLabel", () => {
  it("translates built-in kinds once, ignoring the stored English label", () => {
    expect(occupancyKindDisplayLabel(t, { key: "open", label: "Open" })).toBe("T:rentals.schedule.occupancyKinds.open")
    expect(occupancyKindDisplayLabel(t, { key: "Lesson", label: "Lesson" })).toBe("T:rentals.schedule.occupancyKinds.lesson")
  })

  it("keeps the tenant label for custom kinds", () => {
    expect(occupancyKindDisplayLabel(t, { key: "maintenance", label: "Manutenção" })).toBe("Manutenção")
  })
})
