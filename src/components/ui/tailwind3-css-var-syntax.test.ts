import { describe, expect, it } from "vitest"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import config from "../../../tailwind.config"

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

  it("generates invalid borders and focused rings for the shared form controls in both themes", async () => {
    const { root } = await postcss([tailwindcss({
      ...config,
      content: [{ raw: [sources["./input.tsx"], sources["./select.tsx"], sources["./textarea.tsx"]].join("\n"), extension: "tsx" }],
    })]).process("@tailwind utilities;", { from: undefined })
    const rules: { selector: string; declarations: string }[] = []
    root.walkRules((rule) => { rules.push({ selector: rule.selector, declarations: rule.toString() }) })
    const invalid = rules.filter(({ selector }) => selector.includes('[aria-invalid="true"]'))
    expect(invalid.some(({ declarations }) => declarations.includes("border-color: var(--destructive)"))).toBe(true)
    expect(invalid.some(({ selector, declarations }) => selector.includes(":focus-visible") && declarations.includes("--tw-ring-color: var(--destructive)"))).toBe(true)
    expect(invalid.some(({ selector, declarations }) => selector.includes("dark") && selector.includes(":focus-visible") && declarations.includes("--tw-ring-color: var(--destructive)"))).toBe(true)
  })

  it("select/dropdown popups are at least as wide as their trigger and capped to the viewport", () => {
    const select = sources["./select.tsx"]
    const menu = sources["./dropdown-menu.tsx"]
    // min-width is clamped to the available width so it can never defeat the max-width cap
    expect(select).toContain("min-w-[min(var(--anchor-width),var(--available-width))]")
    expect(menu).toContain("min-w-[min(max(8rem,var(--anchor-width)),var(--available-width))]")
    for (const source of [select, menu]) {
      expect(source).toContain("max-w-[var(--available-width)]")
      expect(source).toContain("max-h-[var(--available-height)]")
    }
  })
})
