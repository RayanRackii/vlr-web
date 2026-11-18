import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { describe, expect, it } from "vitest"

import config from "../../tailwind.config"

async function compile(classes: string) {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes }] }),
  ]).process("@tailwind utilities;", { from: undefined })
  return result.css
}

/** Declaration block of a compiled class, e.g. rule(css, "bg-primary/10"). */
function rule(css: string, className: string) {
  const selector = `.${className.replace("/", String.raw`\/`)} {`
  const start = css.indexOf(selector)
  expect(start, `${className} rule missing`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf("}", start))
}

describe("theme colour tokens", () => {
  it("accept opacity modifiers", async () => {
    const css = await compile("bg-primary/10 border-primary/20 bg-sidebar-accent/60")
    expect(rule(css, "bg-primary/10")).toContain("color-mix(in oklch, var(--primary) calc(0.1 * 100%), transparent)")
    expect(rule(css, "border-primary/20")).toContain("calc(0.2 * 100%)")
    expect(rule(css, "bg-sidebar-accent/60")).toContain("var(--sidebar-accent) calc(0.6 * 100%)")
  })

  it("keeps the unmodified colour at full strength", async () => {
    const css = await compile("bg-primary bg-sidebar-accent")
    expect(rule(css, "bg-primary")).toContain("var(--primary) calc(var(--tw-bg-opacity, 1) * 100%), transparent)")
    expect(rule(css, "bg-sidebar-accent")).toContain("var(--sidebar-accent) calc(var(--tw-bg-opacity, 1) * 100%)")
  })

  it("leaves non-colour theme keys untouched", async () => {
    const css = await compile("rounded-lg shadow-md")
    expect(rule(css, "rounded-lg")).toContain("border-radius: var(--radius)")
    const extend = config.theme?.extend as Record<string, unknown>
    for (const key of ["borderRadius", "boxShadow"]) {
      expect(JSON.stringify(extend[key])).not.toContain("color-mix")
    }
  })
})
