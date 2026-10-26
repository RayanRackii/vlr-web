import { describe, expect, it } from "vitest"

// Tailwind 3.4 does not generate the v4 CSS-variable shorthand (`w-(--x)`),
// so such classes silently do nothing. Primitives must use `w-[var(--x)]`.
const sources = import.meta.glob<string>(["./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
})
const V4_VAR_SHORTHAND = /[\w-]+-\(--[\w-]+\)/g

describe("ui primitives use Tailwind 3 arbitrary CSS-var syntax", () => {
  for (const [file, source] of Object.entries(sources)) {
    it(`${file} has no Tailwind v4 \`-(--var)\` classes`, () => {
      expect(source.match(V4_VAR_SHORTHAND) ?? []).toEqual([])
    })
  }

  it("select/dropdown popups are at least as wide as their trigger and capped to the viewport", () => {
    const select = sources["./select.tsx"]
    const menu = sources["./dropdown-menu.tsx"]
    expect(select).toContain("min-w-[var(--anchor-width)]")
    expect(select).toContain("max-h-[var(--available-height)]")
    expect(menu).toContain("min-w-[max(8rem,var(--anchor-width))]")
    expect(menu).toContain("max-h-[var(--available-height)]")
  })
})
