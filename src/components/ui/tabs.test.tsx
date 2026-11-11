import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import tailwindConfig from "../../../tailwind.config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

function markup() {
  return renderToStaticMarkup(
    <Tabs defaultValue="a">
      <TabsList variant="line">
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel</TabsContent>
    </Tabs>,
  )
}

async function compile(html: string) {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: html, extension: "html" }] }),
  ]).process("@tailwind utilities;", { from: undefined })
  return result.css.replace(/\s+/g, " ")
}

describe("Tabs styling hooks", () => {
  it("exposes orientation and active state as data attributes", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel</TabsContent>
      </Tabs>,
    )
    expect(container.querySelector('[data-slot="tabs"]')).toHaveAttribute("data-orientation", "horizontal")
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("data-active")
    expect(screen.getByRole("tab", { name: "B" })).not.toHaveAttribute("data-active")
    const active = screen.getByRole("tab", { name: "A" })
    expect(active.className).toContain("before:inset-x-0")
    expect(active.className).not.toContain("after:inset-x-0")
  })

  it("compiles the orientation and active variants to real selectors", async () => {
    const css = await compile(markup())
    // horizontal tabs stack the list above the panel (not a side column)
    expect(css).toMatch(/\[data-orientation="horizontal"\] ?\{ ?flex-direction: column/)
    // horizontal list keeps its bar height
    expect(css).toMatch(/\.group\\\/tabs\[data-orientation="horizontal"\] \.group-data-horizontal\\\/tabs\\:h-8/)
    // The line sits on ::before. ::after is reserved for the touch-target hit area.
    expect(css).toMatch(/\[data-active\]::before ?\{ ?content: var\(--tw-content\); ?opacity: 1/)
    expect(css).toMatch(/::before ?\{ ?content: var\(--tw-content\); ?bottom: 0px/)
    expect(css).not.toMatch(/\[data-active\]::after[^{]*\{[^}]*opacity: 1/)
    expect(css).not.toContain("bottom: -5px")
  })
})
